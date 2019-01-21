'use strict'
const fs = require('fs');
const path = require('path');
const util = require('util');
const request = require('request');
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');
const csvParse = require('csv-parse');

const loginURL = "https://www.kurashi.tepco.co.jp/pf/ja/pc/mypage/home/index.page?";

let devMode = false;
let chrome = null;
let page = null;
let appdata = null;

init().then(loadCredentials);

async function init() {
    if (process.argv[2] === "dev"){
        devMode = true;
    }
    
    let launchOptions = {
        logLevel: 'info',
        output: 'json'
    }
    
    if (!devMode){
        launchOptions.chromeFlags = ['--headless'];
    }
    
    chrome = await chromeLauncher.launch(launchOptions);
    const debugPort = chrome.port;
    const resp = await util.promisify(request)(`http://localhost:${debugPort}/json/version`);
    const {webSocketDebuggerUrl} = JSON.parse(resp.body);
    const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});
    page = await browser.newPage();
    await page.goto(loginURL,{waituntil:'domcontentloaded'});
}

function loadCredentials(){
    fs.readFile(path.resolve(__dirname,'appdata.json'),'utf8', (err,content) => {
        if (err) {
            console.log("Failed to read appdata.json");
            return;
        }
        try{
            appdata = JSON.parse(content);
            login().then(getUsage);
        }catch (err){
            console.log("Failed to parse appdata.json");
        }
    });
}

async function login(){
    const username = appdata.username;
    const password = appdata.password;
    
    const usernameInput = await page.$('div.p-logout__panel input[name="ACCOUNTUID"]');
    const passwordInput = await page.$('div.p-logout__panel input[name="PASSWORD"]');
    const loginButton = await page.$('button.p-logout__panel__login-btn');
    if (usernameInput == null || passwordInput == null || loginButton == null){
        console.log("Failed to get page element")
        return;
    }
    await usernameInput.type(username);
    await passwordInput.type(password);
    await loginButton.click();
    await page.waitForNavigation({waituntil:'networkidle2'});
}

async function getUsage(){
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth()+1;
    const downloadUrl = 'https://www.kurashi.tepco.co.jp/pf/ja/pc/mypage/learn/comparison.page?ReqID=CsvDL&year='+year+'&month='+month;
    console.log("Downloading " + downloadUrl);
    let downloadedContent = null;
    try{
        downloadedContent = await page.evaluate(async downloadUrl => {
            const fetchResp = await fetch(downloadUrl, {credentials: 'include'});
            return await fetchResp.text();
          }, downloadUrl);
    }catch(err){
        console.log("Failed to obtain csv data");
        return;
    }

    //Original data is in SHIFT-JIS, but let't not bother with encoding
    csvParse(downloadedContent.trim(), {
        columns:true
    },function (err, records){
        if (err){
            console.log("Failed to parse csv data")
            return;
        }

        let dateKey = null
        let usageKey = null;
        let message = '';
        let sum = 0;
        for (let i in records){
            const item = records[i];
            if (dateKey == null){
                const keys = Object.keys(item);
                dateKey = keys[4];
                usageKey = keys[8];
            }
            console.log(item[dateKey] + " " + item[usageKey]);
            message += item[dateKey] + " " + item[usageKey] + "\n";
            sum += parseFloat(item[usageKey]);
        }
        console.log(sum);
        message += sum.toFixed(2);
        request.post({
            uri:appdata.slackhook,
            headers:{
                "content-type": "application/json"
            },
            body: JSON.stringify({ "text": message })
        },(error,response,body) => {
            if (error){
                console.log("Post error " + error);
                return;
            }else{
                chrome.kill();
                process.exit();
            }
        });
    });
    
}



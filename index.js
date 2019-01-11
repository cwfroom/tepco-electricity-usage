'use strict'
const fs = require('fs');
const puppeteer = require('puppeteer');
const csvParse = require('csv-parse');
const loginURL = "https://www.kurashi.tepco.co.jp/pf/ja/pc/mypage/home/index.page?";

let devMode = false;
let page = null;

init().then(loadCredentials);

async function init() {
    if (process.argv[2] === "dev"){
        devMode = true;
    }
    let browser = null;
    if (devMode){
        browser = await puppeteer.launch({headless:false});
    }else{
        browser = await puppeteer.launch();
    }
    page = await browser.newPage();
    await page.goto(loginURL,{waituntil:'domcontentloaded'});
}

function loadCredentials(){
    fs.readFile('appdata.json','utf8', (err,content) => {
        if (err) {
            console.log("Failed to read appdata.json");
            return;
        }
        try{
            const credentials = JSON.parse(content);
            login(credentials).then(getUsage);
        }catch (err){
            console.log("Failed to parse appdata.json");
        }
    });
}

async function login(credentials){
    const username = credentials.username;
    const password = credentials.password;
    
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
    console.log(downloadUrl);
    let downloadedContent = null;
    try{
        downloadedContent = await page.evaluate(async downloadUrl => {
            const fetchResp = await fetch(downloadUrl, {credentials: 'include'});
            return await fetchResp.text();
          }, downloadUrl);
    }catch(err){
        console.log("Failed to obtain csv data");
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
        for (let i in records){
            const item = records[i];
            if (dateKey == null){
                const keys = Object.keys(item);
                dateKey = keys[4];
                usageKey = keys[8];
            }
            console.log(item[dateKey] + " " + item[usageKey]);
        }
    });
    
}



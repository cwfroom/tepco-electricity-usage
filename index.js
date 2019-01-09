'use strict'
const fs = require('fs');
const puppeteer = require('puppeteer');


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
            login(credentials);
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
}

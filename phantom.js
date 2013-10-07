// Usage for phantom.js newbies:
// phantomjs.exe --cookies-file=phantom.js.cookies phantom.js

var page;

function main() {
    page = require('webpage').create();
    page.viewportSize = {width: 1920, height: 960};
    page.onConsoleMessage = log;

    console.log("Opening Cookie Clicker...");
    page.open('http://orteil.dashnet.org/cookieclicker/', function () {
        console.log("Cookie clicker opened.");
        bootStrap();
    });
}

function log(msg) {
    console.log("[" + new Date().toISOString() + "] " + msg);
}

function bootStrap() {
    if (gameLoaded()) {
        init();
    } else {
        setTimeout(bootStrap, 200);
    }
}

function gameLoaded() {
    return page.evaluate(function () {
        return typeof Game !== "undefined" && typeof Game.ClickCookie !== "undefined";
    });
}

function init() {
    console.log("Injecting Greasemonkey script...");
    page.injectJs("cookie.user.js");

    printCookies();
    setTimeout(loop, 5000);
}

function printCookies() {
    log("Current cookies: " + getCookies());
}

function getCookies() {
    return page.evaluate(function () {
        return Game.cookies;
    });
}

function loop() {
    page.evaluate(function () {
        Game.WriteSave();
    });
    page.render("cookies.png")
    printCookies();

    setTimeout(loop, 5000);
}

main();

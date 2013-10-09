// Usage for phantom.js newbies:
// phantomjs.exe --cookies-file=phantom.js.cookies phantom.js

var page;

function main() {
    var system = require('system');
    page = require('webpage').create();
    page.viewportSize = {width: 1920, height: 960};
    page.onConsoleMessage = log;

    console.log("Opening Cookie Clicker...");
    page.open('http://orteil.dashnet.org/cookieclicker/', function () {
        console.log("Cookie Clicker opened.");
        if (system.args.length > 1) {
            bootStrap(system.args[1]);
        } else {
            bootStrap();
        }
    });
}

function log(msg) {
    console.log("[" + new Date().toISOString() + "] " + msg);
}

function bootStrap(clicksPerSecond) {
    if (gameLoaded()) {
        init(clicksPerSecond);
    } else {
        setTimeout(bootStrap, 200);
    }
}

function gameLoaded() {
    return page.evaluate(function () {
        return typeof Game !== "undefined" && typeof Game.ClickCookie !== "undefined";
    });
}

function init(clicksPerSecond) {
    console.log("Setting PhantomJS click rate parameter...");
    page.evaluate(function (cps) {
        phantomJsClickRate = cps;
    }, clicksPerSecond);

    // Possible race condition... sometimes setting this variable
    // doesn't seem to take effect.  Inserting a 1 second wait on the
    // remainder of the init logic.
    setTimeout(function () {
        console.log("Injecting Greasemonkey script...");
        page.injectJs("cookie.user.js");

        printStatus();
        setTimeout(loop, 5000);
    }, 1000);
}

function printStatus() {
    var lines = [];
    lines.push("Cookies: " + getCookies()
               + ", Cookies Per Second: " + getCPM());
    lines.push("Cookies to keep for bonuses: " + getCookiesToHold());
    var objNames = [
        "Cursor",
        "Grandma",
        "Farm",
        "Factory",
        "Mine",
        "Shipment",
        "Alchemy lab",
        "Portal",
        "Time machine",
        "Antimatter condenser",
    ];
    var objReport = objNames.map(function (name) {
        var count = page.evaluate(function (name) {
            var matches = Game.ObjectsById.filter(function (o) {
                return o.name === name;
            });
            return matches[0].amount;
        }, name);
        return name + ": " + count;
    });
    lines.push(objReport.slice(0, 5).join(", "));
    lines.push(objReport.slice(5, 9).join(", "));
    lines.push(objReport[9]);
    lines = lines.map(function (line) {
        return "    " + line;
    });
    log("\n" + lines.join("\n"));
}

function getCookies() {
    return page.evaluate(function () {
        return Beautify(Game.cookies);
    });
}

function getCPM() {
    return page.evaluate(function () {
        return Beautify(Game.cookiesPs, 1);
    });
}

function getCookiesToHold() {
    return page.evaluate(function () {
        return Beautify(CookieBot.cookiesToHold());
    });
}

function loop() {
    // page.evaluate(function () {
    //     Game.WriteSave();
    // });

    // Uncomment to render page as PNG.
    //page.render("cookies.png")

    printStatus();

    setTimeout(loop, 5000);
}

main();

// ==UserScript==
// @name vultaire.net CookieBot
// @namespace http://vultaire.net/gmscripts
// @description A very simple clickslave and AI bot for Cookie Clicker.
// @include http://orteil.dashnet.org/cookieclicker/*
// @version 0.2
// ==/UserScript==

var CookieBot = function () {
    var autoClicker = null;
    var realConfirm = window.confirm;

    function hijackConfirm() {
        // Automatically hit 'yes' for any confirm dialogs.
        // In order to work with TamperMonkey, need to inject into the
        // page directly; can't just override.
        var scriptBody = document.createTextNode([
            "window.confirm = function (message) {",
            "    console.log('Automatically hitting \"yes\" for: ' + message);",
            "    return true;",
            "}",
        ].join(""))
        var script = document.createElement("script");
        script.appendChild(scriptBody);
        document.body.appendChild(script);
    }
    function enableAutoClick() {
        if (autoClicker === null) {
            autoClicker = setInterval(Game.ClickCookie, 200);
        }
    }
    function disableAutoClick() {
        if (autoClicker !== null) {
            clearInterval(autoClicker);
            autoClicker = null;
        }
    }
    function autoBuyUpgrades() {
        var neverBuy = ["Elder Covenant"];
        var bought = false;
        Game.UpgradesInStore.filter(function (upgrade) {
            return upgrade.unlocked && (neverBuy.indexOf(upgrade.name) === -1);
        }).map(function (upgrade) {
            if (!bought && (Game.cookiesd >= upgrade.basePrice)) {
                bought = true;
                upgrade.buy();
            }
        });
    }
    function autoBuyObjects() {
        var bought = false;
        var objects = Game.ObjectsById.sort(function (a, b) {
            return a.price - b.price;
        }).reverse().map(function (object) {
            if (!bought && (Game.cookiesd >= object.price)) {
                bought = true;
                object.buy();
            }
        });
    }

    var objectShoppingOrder = [
        // Syntax: [object, buy-up-to]
        // i.e. if I have 20 cursors and buy-up-to is 50, I buy 30 cursors.
        // If buy-up-to is null, means to just keep buying.
        ["Cursor", 5],
        ["Grandma", 3],
        ["Farm", 3],
        ["Cursor", 20],
        ["Factory", 3],
        ["Mine", 3],
        ["Cursor", 50],
        ["Grandma", 10],
        ["Farm", 10],
        ["Shipment", 5],
        ["Factory", 10],
        ["Mine", 10],
        ["Shipment", 10],
        ["Alchemy lab", 5],
        ["Portal", 10],
        ["Alchemy lab", 10],
        ["Time machine", 20],
        ["Cursor", 100],
        ["Antimatter condenser", 30],
        ["Grandma", 50],
        ["Cursor", 130],
        ["Antimatter condenser", 40],
        ["Farm", 50],
        ["Factory", 50],
        ["Mine", 50],
        ["Shipment", 50],
        ["Cursor", 150],
        ["Antimatter condenser", 50],
        ["Alchemy lab", 50],
        ["Portal", 50],
        ["Time machine", 30],
        ["Cursor", 200],
        ["Antimatter condenser", 60],
        ["Grandma", 128],
        ["Farm", 128],
        ["Factory", 100],
        ["Mine", 100],
        ["Shipment", 100],
        ["Alchemy lab", 100],
        ["Portal", 100],
        ["Time machine", 50],
        ["Antimatter condenser", 70],
        ["Grandma", 150],
        ["Time machine", 80],
        ["Antimatter condenser", 80],
        ["Grandma", 175],
        ["Time machine", 100],
        ["Antimatter condenser", 90],
        ["Grandma", 200],
        ["Antimatter condenser", null],
    ];

    function buyObjectsByRules() {
        while (true) {
            var name = objectShoppingOrder[0][0];
            var target = objectShoppingOrder[0][1];
            var object = Game.ObjectsById.filter(function (object) {
                return object.name === name;
            })[0];
            if (target === null || object.amount < target) {
                return object.buy();
            }
            objectShoppingOrder.shift();
        }
    }
    function clickGoldenCookies() {
        if (Game.goldenCookie.life > 0) {
            Game.goldenCookie.click();
        }
    }
    function tick() {
        autoBuyUpgrades();
        //autoBuyObjects();
        buyObjectsByRules();
        clickGoldenCookies();
    }
    function init() {
        hijackConfirm();
        enableAutoClick();
        setInterval(tick, 500);
    }
    return {
        init: init,
        enableAutoClick: enableAutoClick,
        disableAutoClick: disableAutoClick,
    };
}();

function bootStrap() {
    // Since not everything gets loaded right away... wait a bit.
    if (Game.ClickCookie) {
        CookieBot.init();
    } else {
        setTimeout(bootStrap, 200);
    }
}

bootStrap();

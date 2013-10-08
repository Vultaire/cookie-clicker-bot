// ==UserScript==
// @name vultaire.net CookieBot
// @namespace http://vultaire.net/gmscripts
// @description A very simple clickslave and AI bot for Cookie Clicker.
// @include http://orteil.dashnet.org/cookieclicker/*
// @version 0.5
// ==/UserScript==

// Changes:
// 0.5: Added minimum cookies-on-hand buffer for gaming the Golden Cookies.

var CookieBot = function () {
    var autoClicker = null;
    var realConfirm = window.confirm;

    function injectScript(src) {
        var text = document.createTextNode(src);
        var script = document.createElement("script");
        script.appendChild(text);
        document.body.appendChild(script);
    }

    function hijackFunctions() {
        hijackConfirm();
        hijackGameParticlesAdd();
    }

    function hijackConfirm() {
        // Automatically hit "yes" for any confirm dialogs.
        // In order to work with TamperMonkey, need to inject into the
        // page directly; can't just override.
        injectScript([
            "window.confirm = function (message) {",
            "    console.log('Automatically hitting \"yes\" for: ' + message);",
            "    return true;",
            "}",
        ].join(""))
    }

    function hijackGameParticlesAdd() {
        var fn = Game.particlesAdd;
        Game.particlesAdd = function (text, el) {
            console.log("Popup: " + text)
            return fn(text, el);
        }
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

    function hasGetLucky() {
        return Game.UpgradesById.filter(function (u) {
            return u.name === "Get lucky";
        })[0].bought;
    }

    function cookiesToHold() {
        // Computes an adjustment factor, such that Golden Cookies are
        // as effective as possible.
        var multiplier = 60 * 20;  // Represents 20 minutes of cookies
        if (hasGetLucky()) {
            multiplier *= 7;  // Potential stacked multiplier with "Get Lucky" upgrade.
        }
        var bonusCookies = Game.cookiesPs * multiplier;
        return bonusCookies * 10;  // Bonus cap is 10% of current cookies.
    }

    function autoBuyUpgrades() {
        var neverBuy = ["Elder Covenant"];
        var bought = false;
        Game.UpgradesInStore.filter(function (upgrade) {
            return upgrade.unlocked && (neverBuy.indexOf(upgrade.name) === -1);
        }).map(function (upgrade) {
            var price;
            if (!bought && (Game.cookies - cookiesToHold() >= upgrade.basePrice)) {
                price = upgrade.basePrice;
                bought = true;
                upgrade.buy();
                console.log("Purchased " + upgrade.name
                            + " for " + Beautify(price));
            }
        });
    }
    function autoBuyObjects() {
        var bought = false;
        var objects = Game.ObjectsById.sort(function (a, b) {
            return a.price - b.price;
        }).reverse().map(function (object) {
            var price;
            if (!bought && (Game.cookies - cookiesToHold() >= object.price)) {
                price = object.price;
                bought = true;
                object.buy();
                console.log("Purchased " + object.name
                            + " for " + Beautify(price)
                            + ", current count: " + object.amount);
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
            var price;
            if (target === null || object.amount < target) {
                if (Game.cookies - cookiesToHold() >= object.price) {
                    price = object.price;
                    object.buy();
                    console.log("Purchased " + object.name
                                + " for " + Beautify(price)
                                + ", current count: " + object.amount);
                } else {
                    // Don't do anything this time.
                }
                return;
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
        hijackFunctions();
        enableAutoClick();
        setInterval(tick, 500);
    }
    return {
        init: init,
        enableAutoClick: enableAutoClick,
        disableAutoClick: disableAutoClick,
        cookiesToHold: cookiesToHold,
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

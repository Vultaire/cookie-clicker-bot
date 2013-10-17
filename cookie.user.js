// ==UserScript==
// @name vultaire.net CookieBot
// @namespace http://vultaire.net/gmscripts
// @description A very simple clickslave and AI bot for Cookie Clicker.
// @include http://orteil.dashnet.org/cookieclicker/*
// @version 0.18
// ==/UserScript==

// Changes:
//
// 0.18: Bug fix... now the last change should actually work.
//
// 0.17: Added special case upgrade purchases where the cookie buffer
//   is ignored for particularly high-value purchases, such as kitten
//   and heavenly chip related upgrades.
//
// 0.16: Added new auto-purchase logic: uses a simple algorithm for
//   deciding a purchase based upon the ratio of cookies-per-minute
//   gain against the cost of the upgrade.
//
// 0.15: Fixed the purchase rule list: it now gets re-initialized
//   after resetting.
//
// 0.14: Updated soft reset to consider total cookies made across all
//   resets.
//
// 0.13: Changed "hold buffer" lower bound to 1 billion CPS.
//
// 0.12: Added a tweak: the cookie "hold buffer" only takes effect if
//   you are making at least a million cookies per second.
//
// 0.11: Fixed auto-soft-reset comparison.
//
// 0.10: Added auto-soft-reset when enough cookies have been made to
//   double the end-game income.  (Based upon current max multiplier
//   of 470% @ 0 prestige and 570% at 4+ prestige.)
//
// 0.9: Minor fix on a check for a possibly defined variable; should
//   work in Chrome again.  (I don't *think* it was affecting FireFox,
//   but not sure.)
//
// 0.8: Embarassing error.  Put the click parameter in the wrong
//   place.  Oops.
//
// 0.7: PhantomJS testing support: can effectively parameterize
//   startup by injecting a variable before loading the main script.
//   Added single parameter, phantomJsClickRate, for controlling the
//   autoclick rate.
//
// 0.6: Fixed cookies-on-hand logic: CPS variable reflected Frenzy; we
//   don't want that.
//
// 0.5: Added minimum cookies-on-hand buffer for gaming the Golden
//   Cookies.

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
            var clickInterval = 200;
            if (typeof phantomJsClickRate !== "undefined") {
                console.log("PhantomJS click rate detected; setting to "
                            + phantomJsClickRate + " clicks per second.");
                clickInterval = 1000 / phantomJsClickRate;
            }
            autoClicker = setInterval(Game.ClickCookie, clickInterval);
        }
    }
    function disableAutoClick() {
        if (autoClicker !== null) {
            clearInterval(autoClicker);
            autoClicker = null;
        }
    }

    var objectShoppingOrder = null;

    function initPurchaseRules() {
        objectShoppingOrder = [
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
    }

    function hasGetLucky() {
        return Game.UpgradesById.filter(function (u) {
            return u.name === "Get lucky";
        })[0].bought;
    }

    function cookiesToHold() {
        // Computes an adjustment factor, such that Golden Cookies are
        // as effective as possible.

        // Early game, this just gets in the way, so skip unless our
        // CPS is at a certain level.  Let's say... 1 billion.
        if (Game.cookiesPs < 1000000000) {
            return 0;
        }

        // Get base cookies-per-second, i.e. accomodating for any Frenzy.
        var realCps = Game.cookiesPs;
        if (Game.frenzy > 0) {
            realCps /= Game.frenzyPower;
        }

        // Compute potential CPS multiplier for Lucky.
        var multiplier = 60 * 20;  // Represents 20 minutes of cookies
        if (hasGetLucky()) {
            multiplier *= 7;  // Potential stacked multiplier with "Get Lucky" upgrade.
        }

        var bonusCookies = realCps * multiplier;
        var bonusCap = bonusCookies * 10;
        return bonusCap;
    }

    var neverBuy = ["Elder Covenant"];
    var buyEarly = [
        "Kitten helpers",
        "Kitten workers",
        "Kitten engineers",
        "Kitten overseers",
        "Heavenly chip secret",
        "Heavenly cookie stand",
        "Heavenly bakery",
        "Heavenly confectionery",
        "Heavenly key",
    ];

    function autoBuyPriorityUpgrades() {
        var bought = false;
        Game.UpgradesInStore.filter(function (upgrade) {
            return upgrade.unlocked && (buyEarly.indexOf(upgrade.name) !== -1);
        }).map(function (upgrade) {
            if (!bought && (Game.cookies >= upgrade.basePrice)) {
                bought = true;
                upgrade.buy();
                console.log("Purchased " + upgrade.name
                            + " for " + Beautify(upgrade.basePrice));
            }
        });
        return bought;
    }

    function autoBuyGeneralUpgrades() {
        var bought = false;
        Game.UpgradesInStore.filter(function (upgrade) {
            return upgrade.unlocked && (neverBuy.indexOf(upgrade.name) === -1);
        }).map(function (upgrade) {
            if (!bought && (Game.cookies - cookiesToHold() >= upgrade.basePrice)) {
                bought = true;
                upgrade.buy();
                console.log("Purchased " + upgrade.name
                            + " for " + Beautify(upgrade.basePrice));
            }
        });
        return bought;
    }

    function autoBuyUpgrades() {
        if (!autoBuyPriorityUpgrades()) {
            autoBuyGeneralUpgrades();
        }
    }

    function pricePerCps(o) {
        // Returns price/CPS ratio.
        return o.price/o.cps();
    }
    function autoBuyObjects() {
        var cookiesInFiveMinutes = Game.cookies + (Game.cookiesPs * 60 * 5);
        var candidates = Game.ObjectsById.sort(function (a, b) {
            return pricePerCps(a) - pricePerCps(b);
        }).filter(function (o) {
            return cookiesInFiveMinutes > o.price + cookiesToHold();
        });
        // candidates.map(function (o) {
        //     console.log("Candidate: " + o.name
        //                 + " (" + pricePerCps(o) + " price/CPS)");
        // });
        if (candidates.length > 0) {
            var object = candidates[0];
            if (Game.cookies - cookiesToHold() >= object.price) {
                object.buy();
                console.log(">>> Purchased " + object.name
                            + " for " + Beautify(object.price)
                            + ", current count: " + object.amount);
            } // else {
            //     console.log("Waiting on " + object.name
            //                 + ", price: " + Beautify(object.price)
            //                 + ", price/CPS: " + pricePerCps(object)
            //                 + ", will buy at: "
            //                 + Beautify(object.price + cookiesToHold()));
            // }
        }
    }

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
                    object.buy();
                    console.log("Purchased " + object.name
                                + " for " + Beautify(object.price)
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
    function autoSoftReset() {
        // Exceptions go here...  i.e. don't auto-reset unless you
        // have purchased these items...  For now: don't bother.

        // Begin check for whether we can double our end-game income
        // by resetting.

        var currentPrestige = Game.prestige['Heavenly chips'];
        var base = 470;   // Using 100 (instead of 1.00) as 100%
        // Adjust for cookie requirements which require prestige;
        // these will be available on subsequent runs through.
        base += (25 * Math.min(4, currentPrestige));
        current = base + (2*currentPrestige);  // Current raw multiplier

        // Next: 2*current
        // Next base: 570 (for sure)
        // next: 570 + 2p = 2(current)
        //       2(285 + p) = 2(current)
        //          285 + p = current
        //                p = current - 285
        var targetPrestige = current - 285;
        if (Game.HowMuchPrestige(Game.cookiesEarned + Game.cookiesReset)
            >= targetPrestige) {
            Game.Reset();
            initPurchaseRules();
        }
    }
    function tick() {
        autoBuyUpgrades();
        autoBuyObjects();
        //buyObjectsByRules();
        clickGoldenCookies();
        autoSoftReset();
    }
    function init() {
        hijackFunctions();
        enableAutoClick();
        initPurchaseRules();
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

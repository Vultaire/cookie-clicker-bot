// ==UserScript==
// @name vultaire.net CookieBot
// @namespace http://vultaire.net/gmscripts
// @description A very simple clickslave and AI bot for Cookie Clicker.
// @include http://orteil.dashnet.org/cookieclicker/*
// @version 0.21
// ==/UserScript==

// Changes:
//
// 0.21:
//
//   - Added logic to get the "Neverclick" achievement.  This will slow
//     down the early game significantly until the first million
//     cookies are made, but again, since this is a bot it likely
//     won't be such a big deal.  (This could also be made as a
//     special case requiring prestige, but I opted against this for
//     slightly simpler code.)
//
//   - Moved autoclick init into the neverclick achievement handler.
//
//   - Added logic for getting the "Cookie-dunker" achievement.  This
//     is done by resizing the left-hand canvas where the big cookie
//     and milk are drawn, avoiding the need to resize the actual
//     browser.  This is about the best that can be done w/o having
//     the AI simply cheat and award itself the achievement.
//
//   - Added logic for getting the "Just wrong" achievement; kicks in
//     after you have 10 grandmas.
//
//   - Added logic for getting the "Elder calm" achievement, while in
//     general not buying the elder covenant upgrade.
//
//   - Tweaked interval to be fast enough to get "Uncanny clicker".
//     According to current code, Uncanny Clicker is won basically
//     when the player exceeds 15 clicks per second (66.7 ms per
//     click).  I went for a round number: 50 ms per click.
//
// 0.20: Tweaked auto-purchase logic so it makes smarter decisions
//   end-game.  (The stock 5 minute decision period breaks down at
//   about 90+ antimatter condensers, and likely much sooner w/o
//   prestige.)
//
// 0.19: Minor fix: since Object.cps can supposedly be either a direct
//   value or a function, using Object.storedCps in calculations
//   instead.
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
            var clickInterval = 50;
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
        if (Game.Upgrades["Get lucky"].bought) {
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
        return o.price/o.storedCps;
    }
    function autoBuyObjects() {
        var minutes;
        var condensers = Game.Objects['Antimatter condenser'].amount;
        if (condensers < 1) {
            minutes = 5;      // Decent early game setting
        } else if (condensers < 100) {
            minutes = 60;     // Once condensers are in play, they're
                              // basically the best.  Give plenty of
                              // time for purchasing them.
        } else {
            minutes = 60*24;  // Essentially: pick the best gain/cost
                              // regardless of time.
        }
        var cookiesInFiveMinutes = Game.cookies + (Game.cookiesPs * 60 * minutes);
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
            if (! Game.Achievements['Neverclick'].won) {
                disableAutoClick();
            }
            Game.Reset();
        }
    }
    var clickToFifteen = null;
    function autoNeverClick() {
        if (!Game.Achievements['Neverclick'].won) {
            if (Game.cookieClicks < 15 &&
                clickToFifteen === null) {
                // Click up to 15, then stop.

                var interval = 50;
                function clicker() {
                    Game.ClickCookie();
                    if (Game.cookieClicks < 15) {
                        clickToFifteen = setTimeout(clicker, interval);
                    } else {
                        clickToFifteen = null;
                        if (Game.cookies >= 15) {
                            Game.Objects["Cursor"].buy();
                        }
                    }
                }
                clickToFifteen = setTimeout(clicker, interval);
            } else if (Game.cookieClicks > 15) {
                // Too many clicks to try Neverclick; just enable.
                enableAutoClick();
            }
        } else {
            enableAutoClick();
        }
    }

    var undunkCookie = null;
    function autoCookieDunker() {
        if ((!Game.Achievements["Cookie-dunker"].won)
            && Game.milkProgress > 3.0
            && undunkCookie === null) {
            /*
              Achievement basically won if:
              - More than 10% milk.
              - If 16 pixels or more of the big cookie are submerged below the milk line

              No cross-platform way to resize window it seems, at least at quick glance.

              Canvas can be resized...  This is the closest it seems we can get.

             */

            // Game.milkHd at high milk % will be around 35%... meaning 65% of canvas height.
            // Exact formula to calculate:
            // .4y + 128 - 16 > my
            // .4y + 112 > my
            // (.4y + 112)/y > m
            // .4 + 112/y > m
            // 112/y > m - .4
            // 112 > y(m - .4)
            // 112/(m-.4) > y
            // y < 112/(m-.4)
            // Where:
            //   y: canvas height
            //   m: milk height

            var milkHeightPct = (1-Game.milkHd);
            var dunkHeight = 112/(milkHeightPct-.4);
            dunkHeight -= 1;  // Ensure that we set our height below
                              // the threshold for dunking.

            var oldHeight = Game.LeftBackground.canvas.height;
            Game.LeftBackground.canvas.height = dunkHeight;
            function undunk() {
                Game.LeftBackground.canvas.height = oldHeight;
            }
            // This may take some time to register; wait 10 seconds.
            undunkCookie = setInterval(undunk, 10000);
        }
    }

    function autoElderCalm() {
        var elderCovenant = Game.Upgrades["Elder Covenant"];
        if ((!Game.Achievements["Elder calm"].won)
            && elderCovenant.unlocked
            && Game.cookies >= elderCovenant.basePrice) {

            elderCovenant.buy();
        }
    }

    function autoJustWrong() {
        if ((!Game.Achievements["Just wrong"].won)
            && Game.Objects["Grandma"].amount > 10) {

            Game.Objects["Grandma"].sell();
        }
    }

    function autoAchieve() {
        autoNeverClick();
        autoCookieDunker();
        autoElderCalm();
        autoJustWrong();
    }

    function tick() {
        autoBuyUpgrades();
        autoBuyObjects();
        //buyObjectsByRules();
        clickGoldenCookies();
        autoAchieve();
        autoSoftReset();
    }

    function init() {
        hijackFunctions();
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

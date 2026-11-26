/* ==========================================================
   Custom Cleaners announcement banner
   ----------------------------------------------------------
   HOW TO CHANGE THE BANNER:
   Add, edit or delete entries in the MESSAGES list below.

   id     - any short unique name (change it to re-show a message
            to people who closed an earlier one)
   type   - "hours" (blue), "deal" (yellow), "alert" (red), "gown" (pink)
   title  - short bold label
   text   - the message
   link   - where "Learn more" goes (#locations, #specials, #gown,
            or a page like wedding-gown-preservation.html). "" = no link
   start  - first day to show  (YYYY-MM-DD)
   end    - last day to show   (YYYY-MM-DD)

   The first message whose dates include today is shown.
   If none match, no banner appears.
   ========================================================== */
var MESSAGES = [
  {
    id: "thanksgiving-2026",
    type: "hours",
    title: "Thanksgiving hours:",
    text: "Closed Thursday. Friday and Saturday 8am to 5pm. Clothes received during the holiday weekend will be ready Monday after 5pm.",
    link: "#locations",
    start: "2026-11-24",
    end: "2026-11-28"
  }
];

(function () {
  function day(s) {
    var p = s.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var msg = null;
  for (var i = 0; i < MESSAGES.length; i++) {
    var m = MESSAGES[i];
    if (today >= day(m.start) && today <= day(m.end)) { msg = m; break; }
  }
  if (!msg) return;

  var key = "cc-banner-closed-" + msg.id;
  try { if (localStorage.getItem(key)) return; } catch (e) {}

  var icons = { hours: "i-clock", deal: "i-gift", alert: "i-bolt", gown: "i-heart" };
  var bar = document.createElement("div");
  bar.className = "announce announce-" + (msg.type || "hours");
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Announcement");

  var html =
    '<div class="wrap announce-in">' +
      '<svg class="ic" aria-hidden="true"><use href="#' + (icons[msg.type] || "i-clock") + '"/></svg>' +
      '<p><strong></strong> <span></span>' +
      (msg.link ? ' <a></a>' : '') + '</p>' +
      '<button type="button" class="announce-x" aria-label="Close announcement">&times;</button>' +
    '</div>';
  bar.innerHTML = html;
  bar.querySelector("strong").textContent = msg.title;
  bar.querySelector("span").textContent = msg.text;
  if (msg.link) {
    var a = bar.querySelector("a");
    a.href = msg.link;
    a.textContent = "Learn more";
  }
  bar.querySelector(".announce-x").addEventListener("click", function () {
    bar.remove();
    try { localStorage.setItem(key, "1"); } catch (e) {}
  });

  var header = document.querySelector("header");
  if (header) header.parentNode.insertBefore(bar, header);
  else document.body.insertBefore(bar, document.body.firstChild);
})();

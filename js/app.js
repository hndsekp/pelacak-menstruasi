(function () {
  'use strict';
  var KEY = 'pelacak-menstruasi-v1';
  var PAIN = [['😌', 'Tidak ada'], ['🙂', 'Ringan'], ['😣', 'Sedang'], ['😖', 'Berat'], ['😭', 'Parah']];
  var MOODS = [['😊', 'Senang'], ['😌', 'Tenang'], ['🤩', 'Semangat'], ['😢', 'Sedih'], ['😰', 'Cemas'], ['😠', 'Mudah marah'], ['😴', 'Lelah'], ['🎢', 'Mood swing']];
  var MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var $ = function (id) { return document.getElementById(id); };
  var DEF = { starts: [], cycle: 28, plen: 5, logs: {}, name: '' };

  var st = load();
  var view = new Date(); view.setDate(1);
  var sel = null, draft = null;

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s) return Object.assign({}, DEF, s); } catch (e) {}
    return JSON.parse(JSON.stringify(DEF));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function moodEmoji(l) { for (var i = 0; i < MOODS.length; i++) if (MOODS[i][1] === l) return MOODS[i][0]; return ''; }

  // ---- tanggal ----
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function add(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function diff(a, b) { return Math.round((a - b) / 864e5); }// 864e5 = ms dalam 1 hari
  function nice(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function short(d) { return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3); }
  function clamp(n) { return Math.min(45, Math.max(21, n)); }// batas 21–45 hari
  function avgOf(a) { return Math.round(a.slice(-6).reduce(function (x, y) { return x + y; }, 0) / Math.min(6, a.length)); }

  // ---- algoritma siklus ----ate
  function lengths(s) {
    var d = [];
    for (var i = 1; i < s.length; i++) d.push(diff(parse(s[i]), parse(s[i - 1]))); // awal haid berikutnya − awal haid sebelumnya
    return d;
  }
  function avgCycle() {
    var d = lengths(st.starts.slice().sort());
    return d.length ? clamp(avgOf(d)) : st.cycle; // kalau belum ada data, pakai default 28
  }

  function compute() {
    var m = {}, c = avgCycle(), L = st.plen;
    var s = st.starts.slice().sort();
    function mark(d, k) { var key = iso(d); (m[key] = m[key] || {})[k] = true; }
    var bounds = [];
      // haid yang sudah dicatat
    s.forEach(function (x) { bounds.push(parse(x)); for (var i = 0; i < L; i++) mark(add(parse(x), i), 'period'); });

      // prediksi haid: awal haid terakhir + (rata-rata × k)
    if (s.length) {
      var last = parse(s[s.length - 1]);
      for (var k = 1; k <= 12; k++) {
        var b = add(last, c * k);
        bounds.push(b);
        for (var i = 0; i < L; i++) { var d = add(b, i); if (!(m[iso(d)] && m[iso(d)].period)) mark(d, 'pred'); }
      }
    }

    // ovulasi = haid berikutnya − 14; masa subur = ovulasi −5 sampai +1
    bounds.sort(function (a, b) { return a - b; });
    for (var j = 1; j < bounds.length; j++) {
      var ov = add(bounds[j], -14);
      for (var f = -5; f <= 1; f++) mark(add(ov, f), 'fertile');
      mark(ov, 'ovu');
    }
    return m;
  }

  // ---- riwayat: terlambat / tepat waktu / maju ----
  function status(delta) {
    if (delta >= 2) return { c: 'late', t: '⏳ Terlambat ' + delta + ' hari' };
    if (delta <= -2) return { c: 'early', t: '⚡ Maju ' + (-delta) + ' hari' };
    return { c: 'ok', t: '✅ Tepat waktu' };
  }
  function history() {
    var s = st.starts.slice().sort(), len = lengths(s), out = [];
    for (var i = 1; i < s.length; i++) {
      // harapan: siklus pertama pakai default, selanjutnya rata-rata siklus sebelumnya
      var exp = i > 1 ? clamp(avgOf(len.slice(0, i - 1))) : st.cycle;
      var a = parse(s[i - 1]), b = parse(s[i]), moods = {};
      Object.keys(st.logs).forEach(function (k) {
        if (k >= s[i - 1] && k < s[i] && st.logs[k].moods) st.logs[k].moods.forEach(function (x) { moods[x] = 1; });
      });
      out.push({ a: a, b: b, len: len[i - 1], exp: exp, st: status(len[i - 1] - exp), moods: Object.keys(moods).map(moodEmoji).join(' ') });
    }
    return out.reverse();
  }
  function lateDays() {
    var s = st.starts.slice().sort();
    if (!s.length) return 0;
    return diff(new Date(), add(parse(s[s.length - 1]), avgCycle()));
    // hari ini − (awal haid terakhir + rata-rata siklus)
  }

  // ---- tampilan ----
  function render() {
    var marks = compute(), t = iso(new Date());
    $('monthLabel').textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
    $('hello').textContent = st.name ? 'Halo, ' + st.name + '! 💖' : '';
    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var offset = (first.getDay() + 6) % 7;
    var n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var h = '';
    for (var i = 0; i < offset; i++) h += '<button class="day out" tabindex="-1" aria-hidden="true"></button>';
    for (var d = 1; d <= n; d++) {
      var key = iso(new Date(view.getFullYear(), view.getMonth(), d)), mk = marks[key] || {}, cl = 'day';
      if (mk.fertile) cl += ' fertile';
      if (mk.pred) cl += ' pred';
      if (mk.period) cl += ' period';
      if (mk.ovu) cl += ' ovu';
      if (key === t) cl += ' today';
      if (key === sel) cl += ' sel';
      var lg = st.logs[key], has = lg && (lg.pain > 0 || (lg.moods && lg.moods.length) || lg.note);
      h += '<button class="' + cl + '" data-d="' + key + '">' + d + (has ? '<span class="dot"></span>' : '') + '</button>';
    }
    $('days').innerHTML = h;
    summary(marks, t);
  }

  function summary(marks, t) {
    var s = st.starts.slice().sort(), el = $('summary');
    if (!s.length) {
      el.innerHTML = '<p class="big">Mulai catat siklus 🌷</p><p>Ketuk tanggal hari pertama haid terakhirmu, lalu pilih "Tandai awal haid".</p>';
      return;
    }
    var c = avgCycle(), last = parse(s[s.length - 1]), today = parse(t), late = lateDays();
    if (late >= 1 && late <= 14) {
      // tampilkan "⏳ Terlambat N hari"
      el.innerHTML = '<p class="big">Hari ke -' + (diff(today, last) + 1) + '</p>' +
        '<p>Haid belum datang, terlambat ' + late + ' hari dari prediksi.</p><span class="tag late">⏳ Terlambat ' + late + ' hari</span>';
      return;
    }
    var day = diff(today, last) + 1;// hari siklus = (hari ini − awal haid terakhir) + 1
    while (day > c) { last = add(last, c); day = diff(today, last) + 1; }
    var next = add(last, c), left = diff(next, today);// haid berikutnya & sisa hari
    var tag = marks[t] && marks[t].ovu ? '🥚 Hari ovulasi' : (marks[t] && marks[t].fertile ? '🌱 Masa subur' : '');
    el.innerHTML = '<p class="big">Hari ke' + day + '</p>' +
      '<p>' + (left === 0 ? 'Haid diperkirakan mulai hari ini' : 'Haid berikutnya ' + left + ' hari lagi (' + nice(next) + ')') + '</p>' +
      '<p>Rata-rata siklus: ' + c + ' hari</p>' + (tag ? '<span class="tag">' + tag + '</span>' : '');
  }

  function renderHistory() {
    var h = history(), late = lateDays(), html = '';
    if (late >= 1 && late <= 14) html += '<div class="h-item"><div class="h-top"><span class="h-date">Siklus berjalan</span><span class="badge late">⏳ Terlambat ' + late + ' hari</span></div><p class="h-sub">Belum ada haid baru dicatat.</p></div>';
    h.forEach(function (x) {
      html += '<div class="h-item"><div class="h-top"><span class="h-date">' + short(x.a) + ' – ' + short(add(x.b, -1)) + '</span><span class="badge ' + x.st.c + '">' + x.st.t + '</span></div>' +
        '<p class="h-sub">Siklus ' + x.len + ' hari (prediksi ' + x.exp + ' hari)' + (x.moods ? ' · ' + x.moods : '') + '</p></div>';
    });
    $('histList').innerHTML = html || '<p class="muted">Belum ada riwayat. Catat minimal 2 awal haid agar siklus bisa dibandingkan. 🌸</p>';
  }

  // ---- lembar catatan harian ----
  function openSheet(id) { closeSheets(); $(id).hidden = false; $('bg').hidden = false; }
  function closeSheets() { ['sheet', 'histSheet', 'infoSheet', 'settings'].forEach(function (i) { $(i).hidden = true; }); $('bg').hidden = true; }
  function closeAll() { closeSheets(); sel = null; render(); }

  function open(key) {
    sel = key;
    var lg = st.logs[key] || {};
    draft = { pain: lg.pain || 0, moods: (lg.moods || []).slice() };
    var marks = compute()[key] || {};
    $('sheetDate').textContent = nice(parse(key));
    $('sheetInfo').textContent = marks.ovu ? '🥚 Perkiraan hari ovulasi' : marks.fertile ? '🌱 Masa subur' : marks.period ? '🩸 Hari haid' : marks.pred ? '🌸 Prediksi haid' : '';
    $('btnStart').textContent = st.starts.indexOf(key) > -1 ? 'Batalkan awal haid' : '🩸 Tandai awal haid';
    $('note').value = lg.note || '';
    chips('painChips', PAIN, function (i) { return draft.pain === i; }, function (i) { draft.pain = i; });
    chips('moodChips', MOODS, function (i) { return draft.moods.indexOf(MOODS[i][1]) > -1; }, function (i) {
      var p = draft.moods.indexOf(MOODS[i][1]); p > -1 ? draft.moods.splice(p, 1) : draft.moods.push(MOODS[i][1]);
    });
    openSheet('sheet');
    render();
  }
  function chips(id, list, on, fn) {
    var box = $(id); box.innerHTML = '';
    list.forEach(function (it, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip' + (on(i) ? ' on' : ''); b.textContent = it[0] + ' ' + it[1];
      b.onclick = function () { fn(i); chips(id, list, on, fn); };
      box.appendChild(b);
    });
  }
  function toast(m) { var t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 1800); }

  // ---- popup sambutan ----
  function petals() {
    var e = ['🌸', '💗', '✨', '🌷', '💕', '🦋'], h = '';
    for (var i = 0; i < 12; i++) h += '<span style="left:' + (i * 8.5) + '%;font-size:' + (16 + (i % 4) * 6) + 'px;animation-duration:' + (6 + (i % 5)) + 's;animation-delay:' + (i * .5) + 's">' + e[i % e.length] + '</span>';
    $('petals').innerHTML = h;
  }
  function greet(name, auto) {
    $('wAsk').hidden = true; $('wHi').hidden = false;
    var t = $('wHiText'); t.innerHTML = '';
    ('Halo, ' + name + '! 💖').split('').forEach(function (ch, i) {
      var s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00a0' : ch; s.style.animationDelay = (i * 70) + 'ms'; t.appendChild(s);
    });
    clearTimeout(greet.t);
    greet.t = setTimeout(endWelcome, auto ? 2400 : 2600);
  }
  function endWelcome() {
    var w = $('welcome'); w.classList.add('out');
    setTimeout(function () { w.hidden = true; }, 500);
  }
  function welcome() {
    petals(); $('welcome').hidden = false;
    if (st.name) greet(st.name, true);
    else setTimeout(function () { $('wName').focus(); }, 400);
  }
  $('wGo').onclick = function () {
    var n = $('wName').value.trim();
    if (!n) { $('wName').focus(); return; }
    st.name = n; save(); render(); greet(n, false);
  };
  $('wName').onkeydown = function (e) { if (e.key === 'Enter') $('wGo').click(); };
  $('wHi').onclick = endWelcome;

  // ---- event ----
  $('days').onclick = function (e) { var b = e.target.closest('.day[data-d]'); if (b) open(b.dataset.d); };
  $('prev').onclick = function () { view.setMonth(view.getMonth() - 1); render(); };
  $('next').onclick = function () { view.setMonth(view.getMonth() + 1); render(); };
  $('bg').onclick = $('btnClose').onclick = closeAll;
  Array.prototype.forEach.call(document.querySelectorAll('.closeBtn'), function (b) { b.onclick = closeAll; });
  $('btnInfo').onclick = function () { openSheet('infoSheet'); };
  $('btnHist').onclick = function () { renderHistory(); openSheet('histSheet'); };
  $('btnStart').onclick = function () {
    var p = st.starts.indexOf(sel);
    if (p > -1) { st.starts.splice(p, 1); toast('Awal haid dibatalkan'); }
    else { st.starts.push(sel); st.starts.sort(); toast('Awal haid ditandai 🌸'); }
    save(); closeAll();
  };
  $('btnSave').onclick = function () {
    var note = $('note').value.trim();
    if (!draft.pain && !draft.moods.length && !note) delete st.logs[sel];
    else st.logs[sel] = { pain: draft.pain, moods: draft.moods, note: note };
    save(); closeAll(); toast('Catatan disimpan 💾');
  };
  $('btnSet').onclick = function () {
    $('setName').value = st.name; $('setCycle').value = st.cycle; $('setPlen').value = st.plen;
    openSheet('settings');
  };
  $('btnSetSave').onclick = function () {
    st.name = $('setName').value.trim();
    st.cycle = clamp(+$('setCycle').value || 28);
    st.plen = Math.min(10, Math.max(2, +$('setPlen').value || 5));
    save(); closeAll(); toast('Pengaturan disimpan ✨');
  };
  $('btnReset').onclick = function () {
    if (confirm('Hapus semua data? Tindakan ini tidak bisa dibatalkan.')) {
      st = JSON.parse(JSON.stringify(DEF)); save(); closeAll(); toast('Data dihapus');
    }
  };

  document.addEventListener('deviceready', function () {}, false);
  render();
  welcome();
})();

/*!
 * Haltwise "Check a message" widget. Apache-2.0.
 * Add to any page:
 *   <script src="https://haltwise.onrender.com/embed.js" data-key="hw_sandbox_..." data-lang="en" async></script>
 * Options: data-lang (en, es, ar, hi, ur), data-position (right | left), data-color (any CSS colour), data-open ("true" to start open).
 * Styles live in a shadow root, so they never clash with the host page.
 */
(function () {
  var script = document.currentScript || document.querySelector('script[src*="embed.js"][data-key]')
  if (!script || window.__haltwiseWidget) return
  window.__haltwiseWidget = true

  var API = new URL(script.src).origin
  var KEY = script.getAttribute('data-key') || ''
  var LANG = (script.getAttribute('data-lang') || 'en').slice(0, 2)
  var SIDE = script.getAttribute('data-position') === 'left' ? 'left' : 'right'
  var ACCENT = script.getAttribute('data-color') || '#3ee6c4'
  var RTL = LANG === 'ar' || LANG === 'ur'

  var T = {
    en: ['Check a message', 'Paste a text, email or link you received…', 'Check it', 'Checking…', 'Scam', 'Suspicious', 'No scam signs found', 'Risk', 'Red flags', 'Something went wrong. Try again.', 'Powered by Haltwise · NVIDIA Nemotron', 'Never share codes or move money because someone asks.'],
    es: ['Revisar un mensaje', 'Pegue el texto, correo o enlace que recibió…', 'Revisar', 'Revisando…', 'Estafa', 'Sospechoso', 'Sin señales de estafa', 'Riesgo', 'Señales de alerta', 'Algo salió mal. Inténtelo de nuevo.', 'Con tecnología de Haltwise · NVIDIA Nemotron', 'Nunca comparta códigos ni mueva dinero porque se lo pidan.'],
    ar: ['افحص رسالة', 'الصق النص أو البريد أو الرابط الذي وصلك…', 'افحص', 'جارٍ الفحص…', 'احتيال', 'مشبوه', 'لا توجد علامات احتيال', 'الخطورة', 'علامات التحذير', 'حدث خطأ. حاول مرة أخرى.', 'بدعم من Haltwise · NVIDIA Nemotron', 'لا تشارك الرموز ولا تحوّل المال لأن أحدًا طلب ذلك.'],
    hi: ['संदेश जांचें', 'मिला हुआ टेक्स्ट, ईमेल या लिंक यहाँ चिपकाएँ…', 'जांचें', 'जांच हो रही है…', 'धोखाधड़ी', 'संदिग्ध', 'धोखाधड़ी के संकेत नहीं मिले', 'जोखिम', 'खतरे के संकेत', 'कुछ गलत हुआ। फिर कोशिश करें।', 'Haltwise · NVIDIA Nemotron द्वारा', 'किसी के कहने पर कोड न बताएं, पैसे न भेजें।'],
    ur: ['پیغام جانچیں', 'موصول متن، ای میل یا لنک یہاں چسپاں کریں…', 'جانچیں', 'جانچ ہو رہی ہے…', 'فراڈ', 'مشکوک', 'فراڈ کی نشانیاں نہیں ملیں', 'خطرہ', 'خطرے کی نشانیاں', 'کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔', 'Haltwise · NVIDIA Nemotron کی مدد سے', 'کسی کے کہنے پر کوڈ نہ بتائیں، رقم نہ بھیجیں۔'],
  }
  var t = T[LANG] || T.en

  var host = document.createElement('div')
  host.setAttribute('data-haltwise', '')
  document.body.appendChild(host)
  var root = host.attachShadow({ mode: 'open' })
  root.innerHTML =
    '<style>' +
    ':host{all:initial}' +
    '*{box-sizing:border-box;font-family:Inter,"Noto Sans Arabic","Noto Sans Devanagari",system-ui,sans-serif}' +
    '.fab{position:fixed;bottom:20px;' + SIDE + ':20px;z-index:2147483646;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 16px;background:#0b1426;color:#fff;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.3)}' +
    '.fab i{width:10px;height:10px;border-radius:50%;background:' + ACCENT + ';display:inline-block}' +
    '.panel{position:fixed;bottom:80px;' + SIDE + ':20px;z-index:2147483647;width:min(360px,calc(100vw - 40px));max-height:min(560px,calc(100vh - 110px));overflow:auto;background:#0b1426;color:#e8eefb;border:1px solid #22355c;border-radius:16px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.45);display:none}' +
    '.panel.open{display:block}' +
    'h3{margin:0 0 10px;font-size:16px;display:flex;justify-content:space-between;align-items:center}' +
    'button.x{background:none;border:0;color:#8ea0c4;font-size:18px;cursor:pointer}' +
    'textarea{width:100%;min-height:90px;background:#070e1d;color:#e8eefb;border:1px solid #22355c;border-radius:10px;padding:10px;font-size:13px;resize:vertical}' +
    'textarea:focus{outline:none;border-color:' + ACCENT + '}' +
    '.go{margin-top:10px;width:100%;border:0;border-radius:10px;padding:11px;background:' + ACCENT + ';color:#04201a;font-weight:800;cursor:pointer;font-size:14px}' +
    '.go:disabled{opacity:.6;cursor:wait}' +
    '.res{margin-top:12px;border-radius:12px;padding:12px;border:1px solid;font-size:13px;line-height:1.5}' +
    '.scam{background:rgba(255,93,108,.13);border-color:rgba(255,93,108,.45)}' +
    '.suspicious{background:rgba(255,181,71,.13);border-color:rgba(255,181,71,.45)}' +
    '.likely_safe{background:rgba(61,220,132,.13);border-color:rgba(61,220,132,.4)}' +
    '.res b.v{font-size:15px;display:block;margin-bottom:6px}' +
    '.bar{height:6px;border-radius:4px;background:#1a2a4a;overflow:hidden;margin:6px 0 8px}.bar i{display:block;height:100%}' +
    '.flag{border-inline-start:3px solid #ff5d6c;padding:4px 8px;margin-top:6px;background:rgba(0,0,0,.2)}' +
    '.flag q{font-weight:600;color:#ffd2d6}' +
    '.foot{margin-top:10px;font-size:11px;color:#5b6d93;text-align:center}' +
    '.err{color:#ff5d6c;font-size:12px;margin-top:8px}' +
    '</style>' +
    '<button class="fab" part="button"><i></i>' + esc(t[0]) + '</button>' +
    '<div class="panel" dir="' + (RTL ? 'rtl' : 'ltr') + '" role="dialog" aria-label="' + esc(t[0]) + '">' +
    '<h3>' + esc(t[0]) + '<button class="x" aria-label="Close">×</button></h3>' +
    '<textarea placeholder="' + esc(t[1]) + '"></textarea>' +
    '<button class="go">' + esc(t[2]) + '</button>' +
    '<div class="out"></div>' +
    '<div class="foot">' + esc(t[10]) + '</div>' +
    '</div>'

  var panel = root.querySelector('.panel')
  var input = root.querySelector('textarea')
  var go = root.querySelector('.go')
  var out = root.querySelector('.out')
  root.querySelector('.fab').onclick = function () {
    panel.classList.toggle('open')
    if (panel.classList.contains('open')) input.focus()
  }
  root.querySelector('.x').onclick = function () {
    panel.classList.remove('open')
  }
  if (script.getAttribute('data-open') === 'true') panel.classList.add('open')

  go.onclick = function () {
    var text = input.value.trim()
    if (!text) return
    go.disabled = true
    go.textContent = t[3]
    out.innerHTML = ''
    var isUrl = /^https?:\/\/\S+$/i.test(text)
    var isPhone = /^\+?[\d\s()-]{7,}$/.test(text)
    var body = isUrl ? { url: text, lang: LANG } : isPhone ? { phone: text, lang: LANG } : { text: text, lang: LANG }
    fetch(API + '/v1/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || t[9])
          return j
        })
      })
      .then(function (v) {
        var label = v.verdict === 'scam' ? t[4] : v.verdict === 'suspicious' ? t[5] : t[6]
        var color = v.risk >= 60 ? '#ff5d6c' : v.risk >= 30 ? '#ffb547' : '#3ddc84'
        var flags = (v.red_flags || [])
          .slice(0, 4)
          .map(function (f) {
            return '<div class="flag"><q>' + esc(f.quote) + '</q>' + (f.why ? '<div>' + esc(f.why) + '</div>' : '') + '</div>'
          })
          .join('')
        out.innerHTML =
          '<div class="res ' + esc(v.verdict) + '"><b class="v">' + esc(label) + '</b>' +
          t[7] + ': ' + Number(v.risk) + '/100<div class="bar"><i style="width:' + Math.max(4, Number(v.risk)) + '%;background:' + color + '"></i></div>' +
          esc(v.explanation || '') +
          (v.verdict !== 'likely_safe' ? '<div style="margin-top:6px;font-weight:600">' + esc(t[11]) + '</div>' : '') +
          (flags ? '<div style="margin-top:8px;font-weight:700">' + esc(t[8]) + '</div>' + flags : '') +
          '</div>'
      })
      .catch(function (e) {
        out.innerHTML = '<div class="err">' + esc(e.message || t[9]) + '</div>'
      })
      .then(function () {
        go.disabled = false
        go.textContent = t[2]
      })
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    })
  }
})()

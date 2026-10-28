/** Fallback text used only when a model call fails, so every language still gets an answer. */
type L = 'en' | 'es' | 'ar' | 'hi' | 'ur'
type Dict = Record<L, string>

const T = {
  fallbackScam: {
    en: 'This message shows several signs of a scam: {flags}. Do not click links, share codes, or send money. Contact your bank using the number on your card.',
    es: 'Este mensaje muestra varias señales de estafa: {flags}. No abra enlaces, no comparta códigos ni envíe dinero. Llame a su banco al número de su tarjeta.',
    ar: 'تظهر في هذه الرسالة عدة علامات احتيال: {flags}. لا تفتح الروابط ولا تشارك الرموز ولا ترسل المال. اتصل بمصرفك على الرقم المدوّن على بطاقتك.',
    hi: 'इस संदेश में धोखाधड़ी के कई संकेत हैं: {flags}। लिंक न खोलें, कोड साझा न करें और पैसे न भेजें। अपने कार्ड पर लिखे नंबर पर बैंक को कॉल करें।',
    ur: 'اس پیغام میں فراڈ کی کئی نشانیاں ہیں: {flags}۔ لنک نہ کھولیں، کوڈ شیئر نہ کریں اور رقم نہ بھیجیں۔ اپنے کارڈ پر لکھے نمبر پر بینک کو کال کریں۔',
  },
  fallbackSafe: {
    en: 'We did not find common scam signs in this message. Stay careful: your bank will never ask you to move money to keep it safe.',
    es: 'No encontramos señales comunes de estafa. Tenga cuidado: su banco nunca le pedirá mover dinero para protegerlo.',
    ar: 'لم نجد علامات احتيال شائعة في هذه الرسالة. كن حذرًا: لن يطلب منك مصرفك أبدًا نقل أموالك لحمايتها.',
    hi: 'इस संदेश में धोखाधड़ी के सामान्य संकेत नहीं मिले। सावधान रहें: आपका बैंक कभी पैसे सुरक्षित रखने के लिए ट्रांसफर करने को नहीं कहेगा।',
    ur: 'اس پیغام میں فراڈ کی عام نشانیاں نہیں ملیں۔ محتاط رہیں: آپ کا بینک کبھی رقم محفوظ کرنے کے لیے منتقل کرنے کو نہیں کہے گا۔',
  },
  q1: {
    en: 'Has anyone asked you to make this payment, or told you what to say to the bank?',
    es: '¿Alguien le pidió hacer este pago o le dijo qué decirle al banco?',
    ar: 'هل طلب منك أحد إجراء هذه الدفعة أو أخبرك بما تقوله للبنك؟',
    hi: 'क्या किसी ने आपसे यह भुगतान करने को कहा, या बताया कि बैंक से क्या कहना है?',
    ur: 'کیا کسی نے آپ سے یہ ادائیگی کرنے کو کہا یا بتایا کہ بینک سے کیا کہنا ہے؟',
  },
  q2: {
    en: 'Were you told your money is at risk and must be moved to a "safe" account?',
    es: '¿Le dijeron que su dinero está en riesgo y debe moverlo a una cuenta "segura"?',
    ar: 'هل قيل لك إن أموالك في خطر ويجب نقلها إلى حساب "آمن"؟',
    hi: 'क्या आपसे कहा गया कि आपका पैसा खतरे में है और उसे "सुरक्षित" खाते में भेजना होगा?',
    ur: 'کیا آپ کو بتایا گیا کہ آپ کی رقم خطرے میں ہے اور اسے "محفوظ" اکاؤنٹ میں بھیجنا ہوگا؟',
  },
  q3: {
    en: 'Have you met this person face to face, or paid them before?',
    es: '¿Conoce a esta persona en persona o le ha pagado antes?',
    ar: 'هل قابلت هذا الشخص وجهًا لوجه أو دفعت له من قبل؟',
    hi: 'क्या आप इस व्यक्ति से आमने-सामने मिले हैं या पहले कभी भुगतान किया है?',
    ur: 'کیا آپ اس شخص سے بالمشافہ ملے ہیں یا پہلے کبھی ادائیگی کی ہے؟',
  },
  vopClose: {
    en: 'The name you typed is close to, but not the same as, the name on this account ("{registered}"). Scammers open accounts with names almost like yours so a "safe account" looks real. A real bank never asks you to move money to protect it.',
    es: 'El nombre que escribió se parece, pero no coincide, con el titular de la cuenta ("{registered}"). Los estafadores abren cuentas con nombres casi iguales al suyo para que una "cuenta segura" parezca real. Un banco real nunca le pide mover dinero para protegerlo.',
    ar: 'الاسم الذي كتبته قريب من اسم صاحب الحساب لكنه ليس مطابقًا ("{registered}"). يفتح المحتالون حسابات بأسماء تشبه اسمك ليبدو "الحساب الآمن" حقيقيًا. البنك الحقيقي لا يطلب منك أبدًا نقل أموالك لحمايتها.',
    hi: 'आपने जो नाम लिखा वह इस खाते के नाम ("{registered}") से मिलता-जुलता है, पर वही नहीं है। ठग आपके जैसे नाम से खाते खोलते हैं ताकि "सुरक्षित खाता" असली लगे। असली बैंक कभी पैसे बचाने के लिए ट्रांसफर करने को नहीं कहता।',
    ur: 'آپ کا لکھا ہوا نام اس اکاؤنٹ کے نام ("{registered}") سے ملتا جلتا ہے مگر ایک نہیں۔ فراڈیے آپ جیسے نام سے اکاؤنٹ کھولتے ہیں تاکہ "محفوظ اکاؤنٹ" اصلی لگے۔ اصلی بینک کبھی رقم بچانے کے لیے منتقل کرنے کو نہیں کہتا۔',
  },
  vopNo: {
    en: 'The name you typed does not match the account holder. Money sent to the wrong person is very hard to get back. Check the details with the person using a number you already trust.',
    es: 'El nombre no coincide con el titular de la cuenta. Recuperar dinero enviado a otra persona es muy difícil. Verifique los datos llamando a un número de confianza.',
    ar: 'الاسم لا يطابق صاحب الحساب. استرداد المال المرسل للشخص الخطأ صعب جدًا. تحقق من البيانات عبر رقم تثق به.',
    hi: 'नाम खाताधारक से मेल नहीं खाता। गलत व्यक्ति को भेजा पैसा वापस पाना बहुत मुश्किल है। भरोसेमंद नंबर से विवरण जांचें।',
    ur: 'نام اکاؤنٹ ہولڈر سے نہیں ملتا۔ غلط شخص کو بھیجی رقم واپس لینا بہت مشکل ہے۔ قابلِ اعتماد نمبر سے تفصیلات کی تصدیق کریں۔',
  },
  hold: {
    en: 'We have paused this payment to protect you. A specialist will review it. Nothing has left your account.',
    es: 'Hemos pausado este pago para protegerle. Un especialista lo revisará. No ha salido dinero de su cuenta.',
    ar: 'أوقفنا هذه الدفعة مؤقتًا لحمايتك. سيراجعها مختص. لم يخرج أي مبلغ من حسابك.',
    hi: 'आपकी सुरक्षा के लिए हमने यह भुगतान रोक दिया है। एक विशेषज्ञ इसकी समीक्षा करेगा। आपके खाते से कोई पैसा नहीं गया।',
    ur: 'آپ کی حفاظت کے لیے ہم نے یہ ادائیگی روک دی ہے۔ ایک ماہر اس کا جائزہ لے گا۔ آپ کے اکاؤنٹ سے کوئی رقم نہیں گئی۔',
  },
  callWarn: {
    en: 'Warning: this call uses scam tactics ({tactics}). Your bank will never ask you to move money. Hang up and call the number on your card.',
    es: 'Atención: esta llamada usa tácticas de estafa ({tactics}). Su banco nunca le pedirá mover dinero. Cuelgue y llame al número de su tarjeta.',
    ar: 'تحذير: هذه المكالمة تستخدم أساليب احتيال ({tactics}). لن يطلب منك البنك نقل أموالك. أغلق الخط واتصل بالرقم على بطاقتك.',
    hi: 'चेतावनी: इस कॉल में धोखाधड़ी की तरकीबें हैं ({tactics})। आपका बैंक कभी पैसे ट्रांसफर करने को नहीं कहेगा। फोन काटें और कार्ड पर लिखे नंबर पर कॉल करें।',
    ur: 'خبردار: اس کال میں فراڈ کے حربے ہیں ({tactics})۔ آپ کا بینک کبھی رقم منتقل کرنے کو نہیں کہے گا۔ فون بند کریں اور کارڈ پر لکھے نمبر پر کال کریں۔',
  },
  responder: {
    en: "You're not alone, and it's not your fault. We have frozen your card, blocked new payments and opened a dispute. Your case ID is {caseId}.",
    es: 'No está solo y no es su culpa. Hemos congelado su tarjeta, bloqueado pagos nuevos y abierto una disputa. Su número de caso es {caseId}.',
    ar: 'لست وحدك، وهذا ليس خطأك. جمّدنا بطاقتك وأوقفنا المدفوعات الجديدة وفتحنا نزاعًا. رقم قضيتك {caseId}.',
    hi: 'आप अकेले नहीं हैं, और यह आपकी गलती नहीं है। हमने आपका कार्ड फ्रीज़ किया, नए भुगतान रोके और विवाद दर्ज किया। आपका केस आईडी {caseId} है।',
    ur: 'آپ اکیلے نہیں ہیں، اور یہ آپ کی غلطی نہیں۔ ہم نے آپ کا کارڈ منجمد، نئی ادائیگیاں بند اور تنازع درج کر دیا ہے۔ آپ کا کیس نمبر {caseId} ہے۔',
  },
} satisfies Record<string, Dict>

const SCRIPT: Record<string, RegExp> = { ar: /[؀-ۿ]/g, ur: /[؀-ۿ]/g, hi: /[ऀ-ॿ]/g }
const EN_WORDS = /\b(the|you|your|this|that|to|is|are|was|has|have|and|of|for|with|money|payment|account)\b/gi
const ES_WORDS = /\b(el|la|los|las|su|sus|de|que|para|con|una?|es|está|dinero|pago|cuenta|usted|le)\b/gi

/**
 * Cheap check that model text is really in the customer's language. Super sometimes answered in English when asked
 * for Spanish (English examples in the prompt pulled it over), so customer-facing text is verified before use.
 */
export function inLanguage(text: string, lang: string) {
  const s = text.trim()
  if (!s || lang === 'en') return true
  const letters = (s.match(/\p{L}/gu) ?? []).length || 1
  // Super once mixed Polish, Japanese and Russian fragments into an Urdu sentence; those scripts never belong here.
  if (/[Ѐ-ӿ぀-ヿ一-鿿가-힯]/.test(s)) return false
  if (SCRIPT[lang]) {
    const prose = s.replace(/https?:\/\/\S+|\b[\w.-]+\.(com|net|org|top|xyz|icu|pk|in|uk)\b/gi, '')
    const n = (prose.match(/\p{L}/gu) ?? []).length || 1
    const latin = (prose.match(/[A-Za-zÀ-ɏ]/g) ?? []).length
    // Urdu/Arabic must not drift into Devanagari and vice versa (seen: "माँگی" inside an Urdu sentence).
    const wrongScript = lang === 'hi' ? /[؀-ۿ]/.test(prose) : /[ऀ-ॿ]/.test(prose)
    return !wrongScript && latin / n <= 0.08 && (prose.match(SCRIPT[lang]) ?? []).length / n > 0.6
  }
  if (lang === 'es') return (s.match(ES_WORDS) ?? []).length >= (s.match(EN_WORDS) ?? []).length
  return true
}

export function t(key: keyof typeof T, lang: string, vars: Record<string, string> = {}) {
  const d = T[key] as Dict
  let s = d[(lang as L) in d ? (lang as L) : 'en']
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}

export const TACTIC_LABELS: Record<string, Dict> = {
  urgency: { en: 'urgency', es: 'urgencia', ar: 'الاستعجال', hi: 'जल्दबाज़ी', ur: 'جلد بازی' },
  safe_account: { en: '"safe account"', es: '"cuenta segura"', ar: '"حساب آمن"', hi: '"सुरक्षित खाता"', ur: '"محفوظ اکاؤنٹ"' },
  secrecy: { en: 'secrecy', es: 'secretismo', ar: 'السرية', hi: 'गोपनीयता', ur: 'رازداری' },
  remote_access: { en: 'remote access', es: 'acceso remoto', ar: 'التحكم عن بُعد', hi: 'रिमोट एक्सेस', ur: 'ریموٹ رسائی' },
  gift_card_crypto: { en: 'gift cards / crypto', es: 'tarjetas regalo / cripto', ar: 'بطاقات هدايا / عملات رقمية', hi: 'गिफ्ट कार्ड / क्रिप्टो', ur: 'گفٹ کارڈ / کرپٹو' },
  ignore_bank_warnings: { en: 'told to ignore bank warnings', es: 'ignorar avisos del banco', ar: 'تجاهل تحذيرات البنك', hi: 'बैंक चेतावनी अनदेखी', ur: 'بینک کی تنبیہ نظرانداز' },
  credentials: { en: 'asks for codes / PIN', es: 'pide códigos / PIN', ar: 'يطلب الرموز', hi: 'कोड / पिन मांगना', ur: 'کوڈ / پن مانگنا' },
  impersonation: { en: 'impersonation', es: 'suplantación', ar: 'انتحال صفة', hi: 'नकली पहचान', ur: 'جعلی شناخت' },
  fee_or_toll: { en: 'small fee / toll', es: 'pequeña tarifa / peaje', ar: 'رسوم صغيرة', hi: 'छोटा शुल्क', ur: 'معمولی فیس' },
  prize: { en: 'prize bait', es: 'premio falso', ar: 'جائزة وهمية', hi: 'नकली इनाम', ur: 'جعلی انعام' },
  investment: { en: 'guaranteed returns', es: 'ganancias garantizadas', ar: 'أرباح مضمونة', hi: 'गारंटीड मुनाफ़ा', ur: 'یقینی منافع' },
  job: { en: 'too-good job offer', es: 'empleo demasiado bueno', ar: 'عرض عمل مغرٍ', hi: 'अविश्वसनीय नौकरी', ur: 'ناقابلِ یقین نوکری' },
  romance: { en: 'romance pressure', es: 'presión romántica', ar: 'ضغط عاطفي', hi: 'भावनात्मक दबाव', ur: 'جذباتی دباؤ' },
  link: { en: 'suspicious link', es: 'enlace sospechoso', ar: 'رابط مريب', hi: 'संदिग्ध लिंक', ur: 'مشکوک لنک' },
}

export const tacticLabel = (tac: string, lang: string) => {
  const d = TACTIC_LABELS[tac]
  return d ? d[(lang as L) in d ? (lang as L) : 'en'] : tac
}

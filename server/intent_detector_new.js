// ── Intent detector ──────────────────────────────────────────────────────────
function detectIntent(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t || t.length < 2) return 'unknown';

  if (['stop','unsubscribe','ఆపు'].some(k => t.includes(k)))
    return 'stop';

  if (['hello','hi','నమస్కారం','namaskaram','start','hey','menu','welcome','నమస్కారు','నమస్తే','namas'].some(k => t.includes(k)))
    return 'greeting';

  // Price/market — Telugu script (what Vakyansh actually outputs) + English
  if ([
    'ధర','దర','దరా','ధరలు','ధరను','ధరకు',
    'మండి','మంది','మండిలో','మార్కెట్','బజారు',
    'రేట్','రేట్ల','రేటు','రేట్లు',
    'అమ్మకం','కొనుగోలు','విక్రయం',
    'ఈరోజు','నేటి',
    'price','rate','rates','mandi','market','dhara','dharam','bazaar',
    'mirju','mandu','mandy','manni','mande','manda',
  ].some(k => t.includes(k)))
    return 'price';

  // Scheme — Telugu script + English
  if ([
    'పథకం','పథకాల','పథకాలు',
    'స్కీమ్','స్కీముల్','స్కీముల','స్కేముల్','స్కేముల',
    'గవర్నమెంట్','ప్రభుత్వ','సబ్సిడీ','సంక్షేమ','సహాయం',
    'scheme','pathakam','yojana','subsidy','government','welfare','pradhan','kisan','pm ',
  ].some(k => t.includes(k)))
    return 'scheme';

  // Weather — Telugu script + English
  if ([
    'వాతావరణం','వర్షం','వర్ష','వర్షాలు','వానలు','వాన',
    'ఉష్ణోగ్రత','మేఘం','ఆకాశం','గాలి','తుఫాను',
    'weather','rain','forecast','climate','temperature','cloud','today','tomorrow',
  ].some(k => t.includes(k)))
    return 'weather';

  // Loan — Telugu script + English
  if ([
    'రుణం','రుణ','రుణాలు','అప్పు','వడ్డీ','బ్యాంకు','కేసీసీ','నాబార్డ్',
    'loan','credit','kcc','finance','bank','interest','nabard','borrow','runam',
  ].some(k => t.includes(k)))
    return 'loan';

  // Disease / photo — Telugu + English
  if ([
    'రోగం','రోగ','రోగాలు','ఆకు','పురుగు','సమస్య','చీడ','పీడ',
    'ఫోటో','చిత్రం','పంపు','పండి','ద్వరా','ద్వారా',
    'disease','leaf','pest','problem','crop','plant','photo','image','sick','fungi','spot',
  ].some(k => t.includes(k)))
    return 'disease_hint';

  return 'unknown';
}

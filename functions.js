
/* ---------- Szótár ---------- */
const fullWordDictionary = [
  {hungarian:"köszönöm", pinyin:"köszönöm", meaning:"谢谢"},
  {hungarian:"jó napot", pinyin:"jó napot", meaning:"你好"},
  {hungarian:"szeretlek", pinyin:"szeretlek", meaning:"我爱你"},
  {hungarian:"helló", pinyin:"helló", meaning:"你好"},
  {hungarian:"víz", pinyin:"víz", meaning:"水"},
  {hungarian:"anya", pinyin:"anya", meaning:"妈妈"},
  {hungarian:"barát", pinyin:"barát", meaning:"朋友"},
  {hungarian:"reggeli", pinyin:"reggeli", meaning:"早餐"},
  {hungarian:"ebéd", pinyin:"ebéd", meaning:"午餐"},
  {hungarian:"vacsora", pinyin:"vacsora", meaning:"晚餐"},
  {hungarian:"leves", pinyin:"leves", meaning:"汤"},
  {hungarian:"saláta", pinyin:"saláta", meaning:"沙拉"},
  {hungarian: "repülőtér",pinyin: "repülőtér",  meaning: "機場" },
  {hungarian: "térkép",pinyin:"térkép", meaning:"地圖"},
 {hungarian:  "szendvics",  pinyin: "szendvics", meaning: "早餐"},
 {hungarian:  "hamburger",  pinyin: "hamburger", meaning: "早餐"},
 {hungarian:  "pizza",  pinyin: "pizza", meaning: "早餐"},
 {hungarian:  "spagetti",  pinyin: "spagetti", meaning: "早餐"},
 {hungarian:  "rizs",  pinyin: "rizs", meaning: "早餐"},
 {hungarian:  "tészta",  pinyin: "tészta", meaning: "早餐"},
 {hungarian:  "gombóc",  pinyin: "gombóc", meaning: "早餐"},
 {hungarian:  "gőzölt zsemle",  pinyin: "gőzölt zsemle", meaning: "早餐"},
 {hungarian:  "gőzölt kenyér",  pinyin: "gőzölt kenyér", meaning: "早餐"},
 {hungarian:  "torta",  pinyin: "torta", meaning: "早餐"},
 {hungarian:  "keksz",  pinyin: "keksz", meaning: "早餐"},
 {hungarian:  "csokoládé",  pinyin: "csokoládé", meaning: "早餐"},
 {hungarian:  "fagylalt",  pinyin: "fagylalt", meaning: "早餐"},
 {hungarian:  "cukorka",  pinyin: "cukorka", meaning: "早餐"},
 {hungarian:  "alma",  pinyin: "alma", meaning: "早餐"},
 {hungarian:  "banán",  pinyin: "banán", meaning: "早餐"},
 {hungarian:  "narancs",  pinyin: "narancs", meaning: "早餐"},
 {hungarian:  "eper",  pinyin: "eper", meaning: "早餐"},
 {hungarian:  "szőlő",  pinyin: "szőlő", meaning: "早餐"},
 {hungarian:  "görögdinnye",  pinyin: "görögdinnye", meaning: "早餐"},
 {hungarian:  "paradicsom",  pinyin: "paradicsom", meaning: "早餐"},
 {hungarian:  "sárgarépa",  pinyin: "sárgarépa", meaning: "早餐"},
 {hungarian:  "burgonya",  pinyin: "burgonya", meaning: "早餐"},
 {hungarian:  "hagyma",  pinyin: "hagyma", meaning: "早餐"},
 {hungarian:  "fokhagyma",  pinyin: "fokhagyma", meaning: "早餐"},
 {hungarian:  "tej",  pinyin: "tej", meaning: "早餐"},
 {hungarian:  "gyümölcslé",  pinyin: "gyümölcslé", meaning: "早餐"},
 {hungarian:  "kóla",  pinyin: "kóla", meaning: "早餐"},
 {hungarian:  "ásványvíz",  pinyin: "ásványvíz", meaning: "早餐"},
 {hungarian:  "vörösbor",  pinyin: "vörösbor", meaning: "早餐"},
 {hungarian:  "szeszes ital",  pinyin: "szeszes ital", meaning: "早餐"},
 {hungarian:  "koktél",  pinyin: "koktél", meaning: "早餐"},
 {hungarian:  "whisky",  pinyin: "whisky", meaning: "早餐"},
 {hungarian:  "vodka",  pinyin: "vodka", meaning: "早餐"},

 
];

/* ---------- DOM ---------- */
const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const listenBtn = document.getElementById('listenBtn');
const recordBtn = document.getElementById('recordBtn');
const stopBtn = document.getElementById('stopBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const recordingStatus = document.getElementById('recordingStatus');
const targetWordEl = document.getElementById('targetWord');
const targetInfoEl = document.getElementById('targetInfo');
const wordCard = document.getElementById('wordCard');
const progressEl = document.getElementById('progress');
const feedbackArea = document.getElementById('feedbackArea');
const wordCountSelect = document.getElementById('wordCount');

let selectedWords = [], currentIndex = 0;

/* ---------- Capabilities ---------- */
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recognizer = null;
let recogSupported = false;
if (SpeechRec) {
  try {
    recognizer = new SpeechRec();
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.lang = 'hu-HU';
    recogSupported = true;
  } catch(e) {
    recognizer = null;
    recogSupported = false;
  }
}
const isFirefox = typeof InstallTrigger !== 'undefined';

/* ---------- Recording state ---------- */
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let lastTranscript = "";

/* ---------- Helpers ---------- */
function pickRandomWords(n) {
  if (n === 0 || n >= fullWordDictionary.length) return [...fullWordDictionary];
  const shuffled = [...fullWordDictionary].sort(()=>0.5-Math.random());
  return shuffled.slice(0, n);
}
function updateProgress() {
  progressEl.style.display = 'block';
  progressEl.textContent = `${currentIndex+1}/${selectedWords.length}`;
}
function showFeedback(type, title, detail) {
  feedbackArea.style.display = 'block';
  feedbackArea.className = 'feedback';
  if (type === 'good') feedbackArea.classList.add('good');
  else if (type === 'warn') feedbackArea.classList.add('warn');
  else feedbackArea.classList.add('bad');
  feedbackArea.innerHTML = `<div style="font-weight:bold">${title}</div><div style="margin-top:8px;color:#333">${detail}</div>`;
}
function clearFeedback(){
  feedbackArea.style.display = 'none';
  feedbackArea.className = 'feedback';
  feedbackArea.innerHTML = '';
}

/* ---------- Audio envelope utilities (for Firefox path) ---------- */
function estimateSyllableCount(word){
  const v = word.toLowerCase().match(/[aeiouy]+/g);
  return v ? Math.max(1, v.length) : 1;
}
function makeReferenceEnvelope(word, bins=28){
  const syllables = estimateSyllableCount(word);
  const env = new Array(bins).fill(0);
  for (let s=0;s<syllables;s++){
    const center = Math.floor((s+0.5)*bins/syllables);
    const width = Math.max(1, Math.floor(bins/(syllables*1.6)));
    for (let i=0;i<bins;i++){
      const d = Math.abs(i-center);
      env[i] += Math.max(0, (1 - (d/width)));
    }
  }
  const maxv = Math.max(...env);
  if (maxv>0) for (let i=0;i<env.length;i++) env[i] = env[i]/maxv;
  return env;
}
async function getAudioEnvelopeFromBlob(blob, bins=28){
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const channelData = audioBuffer.getChannelData(0);
  const len = channelData.length;
  const binSize = Math.max(1, Math.floor(len / bins));
  const env = new Array(bins).fill(0);
  for (let b=0;b<bins;b++){
    const start = b*binSize;
    const end = (b===bins-1) ? len : (start + binSize);
    let sum = 0;
    for (let i=start;i<end;i++){
      const v = channelData[i];
      sum += v*v;
    }
    const rms = Math.sqrt(sum / Math.max(1, end-start));
    env[b] = rms;
  }
  const maxv = Math.max(...env);
  if (maxv>0) for (let i=0;i<env.length;i++) env[i] = env[i] / maxv;
  return env;
}
function cosineSimilarity(a,b){
  if (!a || !b || a.length !== b.length) return 0;
  let dot=0, na=0, nb=0;
  for (let i=0;i<a.length;i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  if (na===0 || nb===0) return 0;
  return dot / (Math.sqrt(na)*Math.sqrt(nb));
}

/* ---------- Phonetic/simple textual compare (Chromium STT path) ---------- */
const phoneticDictionary = {
  "köszönöm": ["kosonom","ko-so-nom"],
  "jó napot": ["jo napot"], 
  "szeretlek": ["seretlek", "se-ret-lek"],
  "helló": ["hello", "helo","helou"],
  "víz": ["víz","viz"],
  "anya": ["anja","anya"],
  "barát": ["barat", "barát", "bajat"],
  "reggeli": ["reg-ge-li", "regeli"],
  "ebéd": ["ebéd","ebed"],
  "vacsora": ["vachora", "vacora","vatsora"],
  "leves": ["leves", "lefes"],
  "saláta": ["shalata", "shaláta"],
  "repülőtér": ["re-pü-lő-tel","repuloter", "repujote","repülőtér"],
  "térkép": ["térkép", "terkep", "ter-kep", "telkep"]

};
function simpleSimilarity(a, b){
  if (!a || !b) return 0;
  
  // Tisztítás - távolítsuk el a gyakori hibákat
  a = a.toLowerCase().replace(/[.,!?]/g, '').trim();
  b = b.toLowerCase().trim();
  
  // 1. Tökéletes egyezés
  if (a === b) return 1;
  
  // 2. Phonetic dictionary egyezés
  const variants = phoneticDictionary[b] || [];
  if (variants.includes(a)) return 0.85;
  
  // 3. Részleges egyezés - LAZABB (ez a titok!)
  const minLen = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  
  // 60%-os küszöb helyett 40% - így több "jó" beszédet fog elfogadni
  const similarity = matches / Math.max(a.length, b.length);
  return similarity >= 0.4 ? 0.7 : similarity; // LAZABB!
}

function phoneticCompare(spoken, target){
  const s = simpleSimilarity(spoken, target);
  
  if (s >= 0.9) return {match: true, score: 95, type: 'perfect'};
  if (s >= 0.7) return {match: true, score: 80, type: 'good'};    // LAZABB!
  if (s >= 0.5) return {match: true, score: 65, type: 'partial'}; // LAZABB!
  
  return {match: false, score: 20, type: 'no_match'};
}

/* ---------- Flow: recording ---------- */
async function startRecording(){
  try{
    recordingStatus.textContent = '🔄 Accessing microphone...';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate:16000, channelCount:1, echoCancellation:true, noiseSuppression:true } });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data && e.data.size>0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      recordingStatus.textContent = '✅ Saved (ready to analyze)';
      analyzeBtn.disabled = false;
      try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){}
    };
    mediaRecorder.start();
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    analyzeBtn.disabled = true;
    recordingStatus.textContent = '🔴 Start speak... Speak now!';
    lastTranscript = "";

    // if recognizer available, start it in parallel to capture transcript
    // if recognizer available, start it in parallel to capture transcript
if (recogSupported && recognizer) {
  try {
    recognizer.onresult = function(ev){
      if (ev.results && ev.results[0]) {
        lastTranscript = ev.results[0][0].transcript;
        console.log('✅ Böngésző felismert:', lastTranscript, '| Cél szó:', selectedWords[currentIndex]?.hungarian);
        recordingStatus.textContent = `🗣 Recognized: "${lastTranscript}"`;
      }
    };
    
    // Egyszerűsített error handler
    recognizer.onerror = function(ev){ 
      console.warn('Recognizer error', ev); 
    };
    
    recognizer.start();
  } catch(e) {
    console.warn('Recognizer start failed', e);
    recognizer = null; // ⬅️ FONTOS: ha egyszer hibázik, ne próbáljuk újra
  }
}
function stopRecording(){
  if (mediaRecorder && isRecording) {
    try { mediaRecorder.stop(); } catch(e){}
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    recordingStatus.textContent = '⏹ Stopped';
    if (recogSupported && recognizer) try{ recognizer.stop(); }catch(e){}
  }
}

/* ---------- Analyze: STT preferred, else audio-envelope ---------- */
async function analyzeRecording(){
  recordingStatus.textContent = '🔍 Analyzing... - 正在分析...';
  clearFeedback();
  analyzeBtn.disabled = true;

  // If STT recognized something (Chromium path), use textual phonetic compare
  if (recogSupported && lastTranscript && lastTranscript.trim().length>0) {
    const currentWord = selectedWords[currentIndex].hungarian.toLowerCase();
    const spoken = lastTranscript.toLowerCase().trim();
    const res = phoneticCompare(spoken, currentWord);
    if (res.type === 'hungarian') {
      showFeedback('bad', 'Please speak Hungarian - 请说匈牙利语。', `You said - 你说: "${spoken}" — Target - 目标: "${currentWord}"`);
    } else if (res.type === 'perfect') {
      showFeedback('good', 'Perfect! - 完美的！', `You said - 你说: "${spoken}" — Target - 目标: "${currentWord}"`);
    } else if (res.match) {
      showFeedback('good', 'Good pronunciation - 发音清晰', `You said - 你说: "${spoken}" — Target - 目标: "${currentWord}" (Score: ${res.score}%)`);
    } else {
      showFeedback('warn', 'Different word - 不同的词', `You said - 你说: "${spoken}" — Target - 目标: "${currentWord}" (Score: ${res.score}%)`);
    }
    recordingStatus.textContent = '✅ Analysis complete - 分析完成 (STT)';
    return;
  }

  // ELSE: audio-based (Firefox or no transcript)
  if (!audioChunks || audioChunks.length===0) {
    recordingStatus.textContent = '⚠ No recording found. Please record first. - 未找到录音。请先进行录音。';
    showFeedback('bad','No input - 无输入','No recorded audio found — please record your voice. - 未找到录音——请录制您的声音。');
    analyzeBtn.disabled = false;
    return;
  }

  // decode and compute envelope
  const currentWord = selectedWords[currentIndex].hungarian;
  recordingStatus.textContent = '▶ Playing reference (TTS) for timing... - 播放参考（TTS）计时...';
  await playTTS(currentWord);
  recordingStatus.textContent = '⏱ Reference played — processing audio... - 播放参考音频——正在处理音频…';

  const bins = 28;
  const refEnv = makeReferenceEnvelope(currentWord, bins);
  const blob = new Blob(audioChunks, { type: audioChunks[0].type || 'audio/webm' });
  const userEnv = await getAudioEnvelopeFromBlob(blob, bins);

  const avgEnergy = userEnv.reduce((a,b)=>a+b,0)/userEnv.length;
  const maxEnergy = Math.max(...userEnv);

  // Silence/no-speech detection thresholds (tuned conservatively)
  if (avgEnergy < 0.008 || maxEnergy < 0.015) {
    recordingStatus.textContent = '⚠ No speech detected - 未检测到语音';
    showFeedback('bad', 'No speech detected - 未检测到语音', 'Please speak louder or move closer to the microphone. - 请提高音量或靠近麦克风。');
    analyzeBtn.disabled = false;
    return;
  }

  const sim = cosineSimilarity(refEnv, userEnv);
  const pct = Math.round(sim * 100);

  // Interpret percentage to friendly text (no numeric display required, but we include short text)
  if (pct >= 85) {
    showFeedback('good', 'Excellent pronunciation - 发音优美', `Detected acoustic match — high similarity. - 检测到声学匹配——高度相似。`);
  } else if (pct >= 60) {
    showFeedback('good', 'Good pronunciation - 发音清晰', `Detected moderate acoustic similarity. - 检测到中等程度的声学相似性。`);
  } else {
    showFeedback('warn', 'Try again - 再试一次', `Acoustic similarity is low — try to match the reference more closely. - 声学相似度低 — 请更贴近参考发音`);
  }
  recordingStatus.textContent = '✅ Analysis complete - 分析完成 (audio)';
  analyzeBtn.disabled = false;
}

/* ---------- TTS helper ---------- */
function playTTS(text) {
  return new Promise(resolve=>{
    if (!('speechSynthesis' in window)) { setTimeout(resolve, Math.max(500, text.length*60)); return; }
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'hu-HU';
    ut.rate = 0.8;
    ut.onend = ()=> resolve();
    ut.onerror = ()=> resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  });
}

/* ---------- UI wiring ---------- */
startBtn.addEventListener('click', ()=> {
  const n = parseInt(wordCountSelect.value);
  selectedWords = pickRandomWords(n===0?fullWordDictionary.length:n);
  currentIndex = 0;
  wordCard.style.display = 'block';
  progressEl.style.display = 'block';
  updateProgress();
  displayCurrent();
  clearFeedback();
  recordingStatus.textContent = recogSupported ? 'SpeechRecognition available — STT preferred. - 提供语音识别功能——首选 STT。' : 'SpeechRecognition not available — audio analysis will be used. 语音识别功能不可用——将采用音频分析。';
});
nextBtn.addEventListener('click', ()=> {
  if (!selectedWords.length) return;
  currentIndex = (currentIndex + 1) % selectedWords.length;
  updateProgress();
  displayCurrent();
  clearFeedback();
});
listenBtn.addEventListener('click', ()=> {
  const w = selectedWords[currentIndex];
  if (!w) return;
  playTTS(w.hungarian);
});
recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);
analyzeBtn.addEventListener('click', analyzeRecording);

function displayCurrent(){
  if (!selectedWords.length) return;
  const w = selectedWords[currentIndex];
  targetWordEl.textContent = w.hungarian;
  targetInfoEl.textContent = `Pinyin: ${w.pinyin || '-'} — Meaning: ${w.meaning || '-'}`;
  recordingStatus.textContent = 'Click "Start speak - 开始说话", speak, then "Analyze" - 说完后点"分析"';
  recordBtn.disabled = false;
  stopBtn.disabled = true;
  analyzeBtn.disabled = true;
  lastTranscript = "";
  audioChunks = [];
  clearFeedback();
}

/* ---------- Keyboard helper ---------- */
document.addEventListener('keydown', (e)=>{
  if (e.key === ' ' && document.activeElement === recordBtn) { e.preventDefault(); if (!isRecording) startRecording(); else stopRecording(); }
});
recognizer.onresult = function(ev){
  lastTranscript = ev.results[0][0].transcript;
  console.log('✅ Chrome felismert:', lastTranscript, '| Cél szó:', selectedWords[currentIndex]?.hungarian);
  recordingStatus.textContent = `🗣 Recognized: "${lastTranscript}"`;
};
/* ---------- Init ---------- */
(function init(){
  recordingStatus.textContent = recogSupported ? 'SpeechRecognition: available (Chromium).' : 'SpeechRecognition: unavailable — audio-based fallback (Firefox).';
})();







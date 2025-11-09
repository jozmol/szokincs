/* ---------- Szótár ---------- */
const fullWordDictionary = [
  {hungarian:"köszönöm", pinyin:"köszönöm", meaning:"谢谢"},
  {hungarian:"jó napot", pinyin:"jó napot", meaning:"你好"},
  {hungarian:"helló", pinyin:"helló", meaning:"你好"},
  {hungarian:"víz", pinyin:"víz", meaning:"水"},
  {hungarian:"anya", pinyin:"anya", meaning:"妈妈"},
  {hungarian:"barát", pinyin:"barát", meaning:"朋友"},
  {hungarian:"reggeli", pinyin:"reggeli", meaning:"早餐"},
  {hungarian:"ebéd", pinyin:"ebéd", meaning:"午餐"},
  {hungarian:"vacsora", pinyin:"vacsora", meaning:"晚餐"},
  {hungarian:"leves", pinyin:"leves", meaning:"汤"},
  {hungarian:"saláta", pinyin:"saláta", meaning:"沙拉"}
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

/* ---------- Audio envelope utilities ---------- */
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

/* ---------- Phonetic comparison ---------- */
const phoneticDictionary = {
  "köszönöm": ["kosonom","ko-so-nom"],
  "jó napot": ["jo napot"], 
  "helló": ["hello", "helo","helou"],
  "víz": ["víz","viz"],
  "anya": ["anja","anya"],
  "barát": ["barat", "barát", "bajat"],
  "reggeli": ["reg-ge-li", "regeli"],
  "ebéd": ["ebéd","ebed"],
  "vacsora": ["vachora", "vacora","vatsora"],
  "leves": ["leves", "lefes"],
  "saláta": ["shalata", "shaláta"]
};

function simpleSimilarity(a, b){
  if (!a || !b) return 0;
  a = a.toLowerCase().replace(/[.,!?]/g, '').trim();
  b = b.toLowerCase().trim();
  if (a === b) return 1;
  const variants = phoneticDictionary[b] || [];
  if (variants.includes(a)) return 0.85;
  const minLen = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  const similarity = matches / Math.max(a.length, b.length);
  return similarity >= 0.4 ? 0.7 : similarity;
}

function phoneticCompare(spoken, target){
  const s = simpleSimilarity(spoken, target);
  const percentage = Math.round(s * 100);
  
  // ⬇️⬇️⬇️ ÚJ SZÁZALÉKOS VÁLTOZAT ⬇️⬇️⬇️
  if (percentage >= 95) {
    return {match: true, score: percentage, type: 'perfect', message: `Tökéletes! ${percentage}%`};
  } else if (percentage >= 80) {
    return {match: true, score: percentage, type: 'good', message: `Nagyon jó! ${percentage}%`};
  } else if (percentage >= 60) {
    return {match: true, score: percentage, type: 'partial', message: `Jó! ${percentage}%`};
  } else if (percentage >= 40) {
    return {match: false, score: percentage, type: 'almost', message: `Majdnem jó! ${percentage}%`};
  } else if (percentage >= 20) {
    return {match: false, score: percentage, type: 'needs_work', message: `Próbáld újra! ${percentage}%`};
  } else {
    return {match: false, score: percentage, type: 'wrong_word', message: `Más szó: ${percentage}%`};
  }
}

/* ---------- Recording functions ---------- */
async function startRecording(){
  try {
    recordingStatus.textContent = '🔄 Accessing microphone...';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = () => {
      recordingStatus.textContent = '✅ Saved (ready to analyze)';
      analyzeBtn.disabled = false;
      stream.getTracks().forEach(t => t.stop());
    };
    
    mediaRecorder.start();
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    analyzeBtn.disabled = true;
    recordingStatus.textContent = '🔴 Start speak... Speak now!';
    lastTranscript = "";

    // Speech recognition csak Edge-ben
    if (recogSupported && recognizer && !isFirefox) {
      try {
        recognizer.onresult = (ev) => {
          const result = ev.results?.[0]?.[0];
          if (result) {
            lastTranscript = result.transcript;
            console.log('✅ Edge felismert:', lastTranscript);
            recordingStatus.textContent = `🗣 Felismert: "${lastTranscript}"`;
          }
        };
        
        recognizer.onerror = (ev) => {
          console.log('🔇 SpeechRecognition hiba');
          recogSupported = false;
        };
        
        recognizer.start();
      } catch(e) {
        console.log('🔇 SpeechRecognition nem indul');
        recogSupported = false;
      }
    }

  } catch(err) {
    console.error('Recording error', err);
    recordingStatus.textContent = '❌ Microphone access denied or error';
    showFeedback('bad', 'Microphone error', 'Please allow microphone access and retry.');
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

/* ---------- Analysis ---------- */
async function analyzeRecording(){
  recordingStatus.textContent = '🔍 Analyzing...';
  clearFeedback();
  analyzeBtn.disabled = true;

  if (recogSupported && lastTranscript && lastTranscript.trim().length>0) {
    //const currentWord = selectedWords[currentIndex].hungarian.toLowerCase();
    const spoken = lastTranscript.toLowerCase().trim();
    const res = phoneticCompare(spoken, currentWord);
    
    if (res.type === 'perfect') {
     showFeedback(
      res.match ? 'good' : (res.score > 40 ? 'warn' : 'bad'),
      res.message,
      `Elmondtad: "${spoken}" — Cél szó: "${currentWord}"`
    );
    
    recordingStatus.textContent = '✅ Analysis complete (STT)';
    return;
  }

  if (!audioChunks || audioChunks.length===0) {
    recordingStatus.textContent = '⚠ No recording found';
    showFeedback('bad','No input','No recorded audio found');
    analyzeBtn.disabled = false;
    return;
  }

  //const currentWord = selectedWords[currentIndex].hungarian;
  recordingStatus.textContent = '▶ Playing reference...';
  await playTTS(currentWord);
  recordingStatus.textContent = '⏱ Processing audio...';

  const bins = 28;
  const refEnv = makeReferenceEnvelope(currentWord, bins);
  const blob = new Blob(audioChunks, { type: audioChunks[0].type || 'audio/webm' });
  const userEnv = await getAudioEnvelopeFromBlob(blob, bins);

  const avgEnergy = userEnv.reduce((a,b)=>a+b,0)/userEnv.length;
  const maxEnergy = Math.max(...userEnv);

  if (avgEnergy < 0.001 || maxEnergy < 0.005) {
    recordingStatus.textContent = '⚠ No speech detected';
    showFeedback('bad', 'No speech detected', 'Please speak louder');
    analyzeBtn.disabled = false;
    return;
  }

  const sim = cosineSimilarity(refEnv, userEnv);
  const pct = Math.round(sim * 100);

  if (pct >= 85) {
    showFeedback('good', 'Excellent pronunciation', `Detected acoustic match`);
  } else if (pct >= 60) {
    showFeedback('good', 'Good pronunciation', `Detected acoustic similarity`);
  } else {
    showFeedback('warn', 'Try again', `Acoustic similarity is low`);
  }
  recordingStatus.textContent = '✅ Analysis complete (audio)';
  analyzeBtn.disabled = false;
}

/* ---------- TTS helper ---------- */
function playTTS(text) {
  return new Promise(resolve=>{
    if (!('speechSynthesis' in window)) { 
      setTimeout(resolve, Math.max(500, text.length*60)); 
      return; 
    }
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
  recordingStatus.textContent = recogSupported ? 'SpeechRecognition available' : 'SpeechRecognition not available';
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
  recordingStatus.textContent = 'Click "Start speak", speak, then "Analyze"';
  recordBtn.disabled = false;
  stopBtn.disabled = true;
  analyzeBtn.disabled = true;
  lastTranscript = "";
  audioChunks = [];
  clearFeedback();
}

document.addEventListener('keydown', (e)=>{
  if (e.key === ' ' && document.activeElement === recordBtn) { 
    e.preventDefault(); 
    if (!isRecording) startRecording(); else stopRecording(); 
  }
});

/* ---------- Init ---------- */
(function init(){
  recordingStatus.textContent = recogSupported ? 'SpeechRecognition: available' : 'SpeechRecognition: unavailable';
})();




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
  "szeretlek": ["seretlek", "se-ret-lek"],
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
  if (s >= 0.9) return {match: true, score: 95, type: 'perfect'};
  if (s >= 0.7) return {match: true, score: 80, type: 'good'};
  if (s >= 0.5) return {match: true, score: 65, type: 'partial'};
  return {match: false, score: 20, type: 'no_match'};
}
// ⬇️⬇️⬇️ MEGBÍZHATÓ HANGDETEKTÁLÁS ⬇️⬇️⬇️
async function hasActualSpeech(audioChunks) {
  if (!audioChunks || audioChunks.length === 0) {
    console.log('❌ Nincs audio chunk');
    return false;
  }
  
  try {
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    const arrayBuffer = await blob.arrayBuffer();
    
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    
    // 1. ENERIGA SZINT
    const energy = calculateEnergy(channelData);
    console.log('🔊 Energia:', energy);
    
    // 2. DINAMIKUS VÁLTOZÁS (beszéd sok változással jár)
    const dynamics = calculateDynamics(channelData);
    console.log('📈 Dinamika:', dynamics);
    
    // 3. CSEND ARÁNY
    const silenceRatio = calculateSilenceRatio(channelData);
    console.log('🔇 Csend arány:', silenceRatio);
    
    // KRITÉRIUMOK
    const hasEnergy = energy.avg > 0.0005 && energy.max > 0.005&& audioBuffer.duration > 0.3;
    //  const hasSpeech = avgEnergy > 0.0005 && max > 0.005 && audioBuffer.duration > 0.3;
    const hasDynamics = dynamics > 0.2; // Beszéd változatos
    const notMostlySilent = silenceRatio < 0.7; // Nem főleg csend
    
    const hasSpeech = hasEnergy && hasDynamics && notMostlySilent;
    // console.log('🎯 Van beszéd?', hasSpeech);
       console.log('🎯 Beszéd észlelve (laza):', hasSpeech, 
              '(átlag > 0.0005, max > 0.005, duration > 0.3s)');
    
    return hasSpeech;
    
  } catch (error) {
    console.error('❌ Hangdetektálás hiba:', error);
    return false;
  }
}

// SEGÉDFÜGGVÉNYEK
function calculateEnergy(channelData) {
  let sum = 0, max = 0;
  for (let i = 0; i < channelData.length; i++) {
    const value = Math.abs(channelData[i]);
    sum += value;
    if (value > max) max = value;
  }
  return { 
    avg: sum / channelData.length, 
    max: max 
  };
}

function calculateDynamics(channelData) {
  // 10 blokkra osztás és variancia számítás
  const blocks = 10;
  const blockSize = Math.floor(channelData.length / blocks);
  let blockEnergies = [];
  
  for (let i = 0; i < blocks; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let blockSum = 0;
    
    for (let j = start; j < end; j++) {
      blockSum += Math.abs(channelData[j]);
    }
    
    blockEnergies.push(blockSum / (end - start));
  }
  
  const maxEnergy = Math.max(...blockEnergies);
  const minEnergy = Math.min(...blockEnergies);
  return minEnergy > 0 ? (maxEnergy - minEnergy) / maxEnergy : 0;
}

function calculateSilenceRatio(channelData) {
  const silenceThreshold = 0.001;
  let silentSamples = 0;
  
  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) < silenceThreshold) {
      silentSamples++;
    }
  }
  
  return silentSamples / channelData.length;
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
async function analyzeRecording() {
  console.log('🔍 AnalyzeRecording elindult');
  recordingStatus.textContent = '🔍 Analyzing...';
  clearFeedback();
  analyzeBtn.disabled = true;

  // 1. HANGDETEKTÁLÁS
  const hasSpeech = await hasActualSpeech(audioChunks);
  
  if (!hasSpeech) {
    console.log('❌ Nincs beszéd észlelve');
    recordingStatus.textContent = '🔇 No speech detected';
    showFeedback('bad', 'No speech - 未检测到语音', 
                'Please speak into the microphone - 请对着麦克风说话');
    analyzeBtn.disabled = false;
    return;
  }

  console.log('✅ Beszéd észlelve, folytatás...');

  try {
    const currentWord = selectedWords[currentIndex].hungarian;
    console.log('🎯 Cél szó:', currentWord);
    
    // 2. HANGÖSSZEHASONLÍTÁS
    const userEnv = await getAudioEnvelopeFromBlob(new Blob(audioChunks, { type: 'audio/webm' }));
    const refEnv = makeReferenceEnvelope(currentWord);
    const audioSimilarity = cosineSimilarity(refEnv, userEnv);
    const audioPercentage = Math.round(audioSimilarity * 100);
    
    console.log('📊 Hang hasonlóság:', audioPercentage + '%');
    
    // 3. PHONETIKUS ÖSSZEHASONLÍTÁS (ha van STT eredmény)
    let phoneticPercentage = 0;
    let spokenWord = "";
    
    if (recogSupported && lastTranscript && lastTranscript.trim().length > 0) {
      spokenWord = lastTranscript.toLowerCase().trim();
      const phoneticResult = phoneticCompare(spokenWord, currentWord.toLowerCase());
      phoneticPercentage = phoneticResult.score;
      console.log('🗣️ Phonetikus hasonlóság:', phoneticPercentage + '%', 'Bemondott:', spokenWord);
    }
    
    // 4. KOMBINÁLT ÉRTÉKELÉS
    let finalPercentage, finalMessage;
    
    if (phoneticPercentage > 0) {
      // Ha van STT, 70% hangsúly a szövegre
      finalPercentage = Math.round((audioPercentage * 0.3) + (phoneticPercentage * 0.7));
      finalMessage = `Combined: ${finalPercentage}% (Audio: ${audioPercentage}%, Text: ${phoneticPercentage}%)`;
    } else {
      // Ha nincs STT, csak audio + büntetés "bizonytalanságért"
      finalPercentage = Math.round(audioPercentage * 0.8); // -20% büntetés
      finalMessage = `Audio only: ${finalPercentage}% (original: ${audioPercentage}%)`;
    }
    
    console.log('🎯 Végeredmény:', finalMessage);
    
    // 5. OKOS VISSZAJELZÉS
    if (phoneticPercentage > 0 && phoneticPercentage < 40) {
      // HA A SZÖVEG NAGYON ELTÉR, AZT MÁS SZÓNAK TEKINTJÜK
      showFeedback('bad', `Different word - 不同的词`, 
                  `You said: "${spokenWord}" - Target: "${currentWord}" - 您说的是: "${spokenWord}" - 目标是: "${currentWord}"`);
    } else if (finalPercentage >= 80) {
      showFeedback('good', `Excellent! ${finalPercentage}% - 优秀！${finalPercentage}%`, 
                  'Great pronunciation! - 发音很好！');
    } else if (finalPercentage >= 60) {
      showFeedback('good', `Good! ${finalPercentage}% - 好！${finalPercentage}%`, 
                  'Keep practicing! - 继续练习！');
    } else {
      showFeedback('warn', `Needs practice ${finalPercentage}% - 需要练习 ${finalPercentage}%`, 
                  'Try to match the reference - 尝试匹配参考发音');
    }
    
    recordingStatus.textContent = `✅ Analysis complete: ${finalPercentage}%`;
    
  } catch (error) {
    console.error('❌ Hiba a hanganalízisben:', error);
    showFeedback('bad', 'Analysis error - 分析错误', 'Please try again - 请重试');
    recordingStatus.textContent = '❌ Analysis failed';
  }
  
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

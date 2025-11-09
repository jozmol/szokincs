/*----------Szótár----------*/
constfullWordDictionary=[
{hungarian:"köszönöm",pinyin:"köszönöm",meaning:"谢谢"},
{hungarian:"jónapot",pinyin:"jónapot",meaning:"你好"},
{hungarian:"szeretlek",pinyin:"szeretlek",meaning:"我爱你"},
{hungarian:"helló",pinyin:"helló",meaning:"你好"},
{hungarian:"víz",pinyin:"víz",meaning:"水"},
{hungarian:"anya",pinyin:"anya",meaning:"妈妈"},
{hungarian:"barát",pinyin:"barát",meaning:"朋友"},
{hungarian:"reggeli",pinyin:"reggeli",meaning:"早餐"},
{hungarian:"ebéd",pinyin:"ebéd",meaning:"午餐"},
{hungarian:"vacsora",pinyin:"vacsora",meaning:"晚餐"},
{hungarian:"leves",pinyin:"leves",meaning:"汤"},
{hungarian:"saláta",pinyin:"saláta",meaning:"沙拉"},
{hungarian:"szendvics",pinyin:"szendvics",meaning:"早餐"},
{hungarian:"hamburger",pinyin:"hamburger",meaning:"早餐"},
{hungarian:"pizza",pinyin:"pizza",meaning:"早餐"},
{hungarian:"spagetti",pinyin:"spagetti",meaning:"早餐"},
{hungarian:"rizs",pinyin:"rizs",meaning:"早餐"},
{hungarian:"tészta",pinyin:"tészta",meaning:"早餐"},
{hungarian:"gombóc",pinyin:"gombóc",meaning:"早餐"},
{hungarian:"gőzöltzsemle",pinyin:"gőzöltzsemle",meaning:"早餐"},
{hungarian:"gőzöltkenyér",pinyin:"gőzöltkenyér",meaning:"早餐"},
{hungarian:"torta",pinyin:"torta",meaning:"早餐"},
{hungarian:"keksz",pinyin:"keksz",meaning:"早餐"},
{hungarian:"csokoládé",pinyin:"csokoládé",meaning:"早餐"},
{hungarian:"fagylalt",pinyin:"fagylalt",meaning:"早餐"},
{hungarian:"cukorka",pinyin:"cukorka",meaning:"早餐"},
{hungarian:"alma",pinyin:"alma",meaning:"早餐"},
{hungarian:"banán",pinyin:"banán",meaning:"早餐"},
{hungarian:"narancs",pinyin:"narancs",meaning:"早餐"},
{hungarian:"eper",pinyin:"eper",meaning:"早餐"},
{hungarian:"szőlő",pinyin:"szőlő",meaning:"早餐"},
{hungarian:"görögdinnye",pinyin:"görögdinnye",meaning:"早餐"},
{hungarian:"paradicsom",pinyin:"paradicsom",meaning:"早餐"},
{hungarian:"sárgarépa",pinyin:"sárgarépa",meaning:"早餐"},
{hungarian:"burgonya",pinyin:"burgonya",meaning:"早餐"},
{hungarian:"hagyma",pinyin:"hagyma",meaning:"早餐"},
{hungarian:"fokhagyma",pinyin:"fokhagyma",meaning:"早餐"},
{hungarian:"tej",pinyin:"tej",meaning:"早餐"},
{hungarian:"gyümölcslé",pinyin:"gyümölcslé",meaning:"早餐"},
{hungarian:"kóla",pinyin:"kóla",meaning:"早餐"},
{hungarian:"ásványvíz",pinyin:"ásványvíz",meaning:"早餐"},
{hungarian:"vörösbor",pinyin:"vörösbor",meaning:"早餐"},
{hungarian:"szeszesital",pinyin:"szeszesital",meaning:"早餐"},
{hungarian:"koktél",pinyin:"koktél",meaning:"早餐"},
{hungarian:"whisky",pinyin:"whisky",meaning:"早餐"},
{hungarian:"vodka",pinyin:"vodka",meaning:"早餐"}
];

/*----------DOM----------*/
conststartBtn=document.getElementById('startBtn');
constnextBtn=document.getElementById('nextBtn');
constlistenBtn=document.getElementById('listenBtn');
constrecordBtn=document.getElementById('recordBtn');
conststopBtn=document.getElementById('stopBtn');
constanalyzeBtn=document.getElementById('analyzeBtn');
constrecordingStatus=document.getElementById('recordingStatus');
consttargetWordEl=document.getElementById('targetWord');
consttargetInfoEl=document.getElementById('targetInfo');
constwordCard=document.getElementById('wordCard');
constprogressEl=document.getElementById('progress');
constfeedbackArea=document.getElementById('feedbackArea');
constwordCountSelect=document.getElementById('wordCount');

letselectedWords=[],currentIndex=0;

/*----------Capabilities----------*/
constSpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition||null;
letrecognizer=null;
letrecogSupported=false;
if(SpeechRec){
try{
recognizer=newSpeechRec();
recognizer.interimResults=false;
recognizer.maxAlternatives=1;
recognizer.lang='hu-HU';
recogSupported=true;
}catch(e){
recognizer=null;
recogSupported=false;
}
}
constisFirefox=typeofInstallTrigger!=='undefined';

/*----------Recordingstate----------*/
letmediaRecorder=null;
letaudioChunks=[];
letisRecording=false;
letaudioContext=null;
letlastTranscript="";

/*----------Helpers----------*/
functionpickRandomWords(n){
if(n===0||n>=fullWordDictionary.length)return[...fullWordDictionary];
constshuffled=[...fullWordDictionary].sort(()=>0.5-Math.random());
returnshuffled.slice(0,n);
}

functionupdateProgress(){
progressEl.style.display='block';
progressEl.textContent=`${currentIndex+1}/${selectedWords.length}`;
}

functionshowFeedback(type,title,detail){
feedbackArea.style.display='block';
feedbackArea.className='feedback';
if(type==='good')feedbackArea.classList.add('good');
elseif(type==='warn')feedbackArea.classList.add('warn');
elsefeedbackArea.classList.add('bad');
feedbackArea.innerHTML=`<divstyle="font-weight:bold">${title}</div><divstyle="margin-top:8px;color:#333">${detail}</div>`;
}

functionclearFeedback(){
feedbackArea.style.display='none';
feedbackArea.className='feedback';
feedbackArea.innerHTML='';
}

/*----------Audioenvelopeutilities----------*/
functionestimateSyllableCount(word){
constv=word.toLowerCase().match(/[aeiouy]+/g);
returnv?Math.max(1,v.length):1;
}

functionmakeReferenceEnvelope(word,bins=28){
constsyllables=estimateSyllableCount(word);
constenv=newArray(bins).fill(0);
for(lets=0;s<syllables;s++){
constcenter=Math.floor((s+0.5)*bins/syllables);
constwidth=Math.max(1,Math.floor(bins/(syllables*1.6)));
for(leti=0;i<bins;i++){
constd=Math.abs(i-center);
env[i]+=Math.max(0,(1-(d/width)));
}
}
constmaxv=Math.max(...env);
if(maxv>0)for(leti=0;i<env.length;i++)env[i]=env[i]/maxv;
returnenv;
}

asyncfunctiongetAudioEnvelopeFromBlob(blob,bins=28){
if(!audioContext)audioContext=new(window.AudioContext||window.webkitAudioContext)();
constarrayBuffer=awaitblob.arrayBuffer();
constaudioBuffer=awaitaudioContext.decodeAudioData(arrayBuffer);
constchannelData=audioBuffer.getChannelData(0);
constlen=channelData.length;
constbinSize=Math.max(1,Math.floor(len/bins));
constenv=newArray(bins).fill(0);
for(letb=0;b<bins;b++){
conststart=b*binSize;
constend=(b===bins-1)?len:(start+binSize);
letsum=0;
for(leti=start;i<end;i++){
constv=channelData[i];
sum+=v*v;
}
constrms=Math.sqrt(sum/Math.max(1,end-start));
env[b]=rms;
}
constmaxv=Math.max(...env);
if(maxv>0)for(leti=0;i<env.length;i++)env[i]=env[i]/maxv;
returnenv;
}

functioncosineSimilarity(a,b){
if(!a||!b||a.length!==b.length)return0;
letdot=0,na=0,nb=0;
for(leti=0;i<a.length;i++){dot+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}
if(na===0||nb===0)return0;
returndot/(Math.sqrt(na)*Math.sqrt(nb));
}

/*----------Phoneticcomparison----------*/
constphoneticDictionary={
"köszönöm":["kosonom","ko-so-nom"],
"jónapot":["jonapot"],
"szeretlek":["seretlek","se-ret-lek"],
"helló":["hello","helo","helou"],
"víz":["víz","viz"],
"anya":["anja","anya"],
"barát":["barat","barát","bajat"],
"reggeli":["reg-ge-li","regeli"],
"ebéd":["ebéd","ebed"],
"vacsora":["vachora","vacora","vatsora"],
"leves":["leves","lefes"],
"saláta":["shalata","shaláta"],
"szendvics":["sendvich","senvich","senvish"],
"hamburger":["hambuge","hambulge","hamborger"],
"pizza":["piza","pizza","pissa"],
"spagetti":["shpageti","spageti","spagetti"],
"rizs":["riz","ris","rizs"],
"tészta":["testa","tésta","tészta"],
"gombóc":["gombos","gomboc","gombóc"],
"gőzöltzsemle":["gozoltzemle","gözöltzsemle","gozotzemle"],
"gőzöltkenyér":["gozoltkener","gozottkenyer","kozottkenyer"],
"torta":["tolta","toota","torta"],
"keksz":["keks","keksz"],
"csokoládé":["shokolate","csokolade","csokolad"],
"fagylalt":["fagjlat","fagylalt"],
"cukorka":["sukoka","cukoka","cukolka","cukorka"],
"alma":["alma","ama"],
"banán":["banan","banán"],
"narancs":["naanch","nalanc","naansh","nalanch","narancs"],
"eper":["epel","eper"],
"szőlő":["so-lo","sölö","szőlö"],
"görögdinnye":["golog-dinnje","go-rogdinnje","gö-rögdinnye"],
"paradicsom":["par-di-chom","pa-la-dishom","pa-la-dichom"],
"sárgarépa":["sar-ga-repa","sal-ga-lepa","sárga-répa","sarga-repa"],
"burgonya":["bul-go-nja","bur-go-nya"],
"hagyma":["hajma","hadjma","hagyma"],
"fokhagyma":["fok-hagy-ma","fok-hajma","fok-hagyma"],
"tej":["tej"],
"gyümölcslé":["dzsu-molch-le","dzsu-molsh-le","gyu-molc-le","gyu-molch-lé","gyü-mölcs-lé"],
"kóla":["kola","kóla","cola"],
"ásványvíz":["ásványvíz","as-van-viz","ash-vanj-viz","ásh-vány-viz"],
"vörösbor":["vo-losh-bol","vö-rösh-bor","vo-rozs-bo","vo-osh-bor","vörösbor"],
"szeszesital":["se-seshitaa","se-sesital","szeszesital"],
"koktél":["koktail","koktel"],
"whisky":["viski","visky","viszki"],
"vodka":["vod-ka","votka","vodka"]

};

functionsimpleSimilarity(a,b){
if(!a||!b)return0;
a=a.toLowerCase().replace(/[.,!?]/g,'').trim();
b=b.toLowerCase().trim();
if(a===b)return1;
constvariants=phoneticDictionary[b]||[];
if(variants.includes(a))return0.85;
constminLen=Math.min(a.length,b.length);
letmatches=0;
for(leti=0;i<minLen;i++){
if(a[i]===b[i])matches++;
}
constsimilarity=matches/Math.max(a.length,b.length);
returnsimilarity>=0.4?0.7:similarity;
}

functionphoneticCompare(spoken,target){
consts=simpleSimilarity(spoken,target);
if(s>=0.9)return{match:true,score:95,type:'perfect'};
if(s>=0.7)return{match:true,score:80,type:'good'};
if(s>=0.5)return{match:true,score:65,type:'partial'};
return{match:false,score:20,type:'no_match'};
}

/*----------Recordingfunctions----------*/
asyncfunctionstartRecording(){
try{
recordingStatus.textContent='🔄Accessingmicrophone...';
conststream=awaitnavigator.mediaDevices.getUserMedia({audio:true});

audioChunks=[];
mediaRecorder=newMediaRecorder(stream);

mediaRecorder.ondataavailable=e=>{
if(e.data&&e.data.size>0)audioChunks.push(e.data);
};

mediaRecorder.onstop=()=>{
recordingStatus.textContent='✅Saved(readytoanalyze)';
analyzeBtn.disabled=false;
stream.getTracks().forEach(t=>t.stop());
};

mediaRecorder.start();
isRecording=true;
recordBtn.disabled=true;
stopBtn.disabled=false;
analyzeBtn.disabled=true;
recordingStatus.textContent='🔴Startspeak...Speaknow!';
lastTranscript="";

//SpeechrecognitioncsakEdge-ben
if(recogSupported&&recognizer&&!isFirefox){
try{
recognizer.onresult=(ev)=>{
constresult=ev.results?.[0]?.[0];
if(result){
lastTranscript=result.transcript;
console.log('✅Edgefelismert:',lastTranscript);
recordingStatus.textContent=`🗣Felismert:"${lastTranscript}"`;
}
};

recognizer.onerror=(ev)=>{
console.log('🔇SpeechRecognitionhiba');
recogSupported=false;
};

recognizer.start();
}catch(e){
console.log('🔇SpeechRecognitionnemindul');
recogSupported=false;
}
}

}catch(err){
console.error('Recordingerror',err);
recordingStatus.textContent='❌Microphoneaccessdeniedorerror';
showFeedback('bad','Microphoneerror','Pleaseallowmicrophoneaccessandretry.');
}
}

functionstopRecording(){
if(mediaRecorder&&isRecording){
try{mediaRecorder.stop();}catch(e){}
isRecording=false;
recordBtn.disabled=false;
stopBtn.disabled=true;
recordingStatus.textContent='⏹Stopped';
if(recogSupported&&recognizer)try{recognizer.stop();}catch(e){}
}
}

/*----------Analysis----------*/
asyncfunctionanalyzeRecording(){
recordingStatus.textContent='🔍Analyzing...';
clearFeedback();
analyzeBtn.disabled=true;

if(recogSupported&&lastTranscript&&lastTranscript.trim().length>0){
constcurrentWord=selectedWords[currentIndex].hungarian.toLowerCase();
constspoken=lastTranscript.toLowerCase().trim();
constres=phoneticCompare(spoken,currentWord);

if(res.type==='perfect'){
showFeedback('good','Perfect!',`Yousaid:"${spoken}"—Target:"${currentWord}"`);
}elseif(res.match){
showFeedback('good','Goodpronunciation',`Yousaid:"${spoken}"—Target:"${currentWord}"`);
}else{
showFeedback('warn','Differentword',`Yousaid:"${spoken}"—Target:"${currentWord}"`);
}
recordingStatus.textContent='✅Analysiscomplete(STT)';
return;
}

if(!audioChunks||audioChunks.length===0){
recordingStatus.textContent='⚠Norecordingfound';
showFeedback('bad','Noinput','Norecordedaudiofound');
analyzeBtn.disabled=false;
return;
}

constcurrentWord=selectedWords[currentIndex].hungarian;
recordingStatus.textContent='▶Playingreference...';
awaitplayTTS(currentWord);
recordingStatus.textContent='⏱Processingaudio...';

constbins=28;
constrefEnv=makeReferenceEnvelope(currentWord,bins);
constblob=newBlob(audioChunks,{type:audioChunks[0].type||'audio/webm'});
constuserEnv=awaitgetAudioEnvelopeFromBlob(blob,bins);

constavgEnergy=userEnv.reduce((a,b)=>a+b,0)/userEnv.length;
constmaxEnergy=Math.max(...userEnv);

if(avgEnergy<0.001||maxEnergy<0.005){
recordingStatus.textContent='⚠Nospeechdetected';
showFeedback('bad','Nospeechdetected','Pleasespeaklouder');
analyzeBtn.disabled=false;
return;
}

constsim=cosineSimilarity(refEnv,userEnv);
constpct=Math.round(sim*100);

if(pct>=85){
showFeedback('good','Excellentpronunciation',`Detectedacousticmatch`);
}elseif(pct>=60){
showFeedback('good','Goodpronunciation',`Detectedacousticsimilarity`);
}else{
showFeedback('warn','Tryagain',`Acousticsimilarityislow`);
}
recordingStatus.textContent='✅Analysiscomplete(audio)';
analyzeBtn.disabled=false;
}

/*----------TTShelper----------*/
functionplayTTS(text){
returnnewPromise(resolve=>{
if(!('speechSynthesis'inwindow)){
setTimeout(resolve,Math.max(500,text.length*60));
return;
}
constut=newSpeechSynthesisUtterance(text);
ut.lang='hu-HU';
ut.rate=0.8;
ut.onend=()=>resolve();
ut.onerror=()=>resolve();
window.speechSynthesis.cancel();
window.speechSynthesis.speak(ut);
});
}

/*----------UIwiring----------*/
startBtn.addEventListener('click',()=>{
constn=parseInt(wordCountSelect.value);
selectedWords=pickRandomWords(n===0?fullWordDictionary.length:n);
currentIndex=0;
wordCard.style.display='block';
progressEl.style.display='block';
updateProgress();
displayCurrent();
clearFeedback();
recordingStatus.textContent=recogSupported?'SpeechRecognitionavailable':'SpeechRecognitionnotavailable';
});

nextBtn.addEventListener('click',()=>{
if(!selectedWords.length)return;
currentIndex=(currentIndex+1)%selectedWords.length;
updateProgress();
displayCurrent();
clearFeedback();
});

listenBtn.addEventListener('click',()=>{
constw=selectedWords[currentIndex];
if(!w)return;
playTTS(w.hungarian);
});

recordBtn.addEventListener('click',startRecording);
stopBtn.addEventListener('click',stopRecording);
analyzeBtn.addEventListener('click',analyzeRecording);

functiondisplayCurrent(){
if(!selectedWords.length)return;
constw=selectedWords[currentIndex];
targetWordEl.textContent=w.hungarian;
targetInfoEl.textContent=`Pinyin:${w.pinyin||'-'}—Meaning:${w.meaning||'-'}`;
recordingStatus.textContent='Click"Startspeak",speak,then"Analyze"';
recordBtn.disabled=false;
stopBtn.disabled=true;
analyzeBtn.disabled=true;
lastTranscript="";
audioChunks=[];
clearFeedback();
}

document.addEventListener('keydown',(e)=>{
if(e.key===''&&document.activeElement===recordBtn){
e.preventDefault();
if(!isRecording)startRecording();elsestopRecording();
}
});

/*----------Init----------*/
(functioninit(){
recordingStatus.textContent=recogSupported?'SpeechRecognition:available':'SpeechRecognition:unavailable';
})();







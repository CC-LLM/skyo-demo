const skyoUrl = 'http://81.70.27.15:9900';
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@8.3.2/dist/esm-browser/index.js'; 
let isPlaying = false; // 标记当前是否正在播放

const startBtn = document.getElementById('start-record');
const stopBtn = document.getElementById('stop-record'); 
const fileInput = document.getElementById('upload-file');
const audioElement = document.getElementById('audio-playback');
const outputText = document.getElementById('output-text');
let start_play_time = null;
let play_counter = 0;
let total_play_time = 0;


// text to text
const inputText = document.getElementById('input-text-tt');
const sendTextBtn = document.getElementById('send-text-tt');
const outputTextTT = document.getElementById('output-text-tt');

// text to speech
const inputTextTTS = document.getElementById('input-text-tts');
const sendTextBtnTTS = document.getElementById('send-text-tts');
const audioElementTTS = document.getElementById('audio-playback-tts');

// asr
const fileInputASR = document.getElementById('upload-file-asr');
const outputTextASR = document.getElementById('output-text-asr');

let mediaRecorder;
console.info('start');
// 处理麦克风录音
startBtn.addEventListener('click', async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  let audioChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  // 录音停止时自动上传音频
  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioChunks = [];  // 清空音频数据
    const base64Audio = await blobToBase64(audioBlob);
    console.info('base64Audio', base64Audio.length);
    await uploadAudio(base64Audio, 'audio');  // 调用上传函数
  };

  mediaRecorder.start();
  startBtn.disabled = true;  // 禁用开始按钮
  stopBtn.disabled = false;  // 启用停止按钮
});

    // 处理停止录音按钮
stopBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();  // 停止录音
    startBtn.disabled = false;  // 启用开始按钮
    stopBtn.disabled = true;  // 禁用停止按钮
  }
});

// 处理文件上传
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  console.info('got file');
  start_play_time = new Date();
  play_counter = 0;
  total_play_time = 0;

  if (file) {
    const base64Audio = await blobToBase64(file);
    await uploadAudio(base64Audio, 'audio');
  }
  fileInput.value = '';
  outputText.value = '';
});


async function uploadAudio(base64Audio, streamType) {
    const reqid = uuidv4();
    console.info('reqid', reqid);
    const jsonPayload = JSON.stringify({
      audio: base64Audio,
      request_id: reqid,
    });

    // 发送音频数据到后端
    await fetch(`${skyoUrl}/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: jsonPayload
    });

    // 启动 SSE 监听处理结果
    if (streamType == 'audio') {
      // streamAudio(reqid);
      playStreamedAudio(reqid);
    } else if (streamType == 'asr') {
      streamASR(reqid);
    }
  }

// Blob 转为 Base64 编码
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result.split(',')[1]); // 去掉 data URI 前缀，获取 base64 数据
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 播放队列中的下一个音频
async function playStreamedAudio(reqid) {
  const audioContext = new AudioContext();
  const audioQueue = [];
  let isPlaying = false;


  // 播放队列中的音频块
  function playNextAudioInQueue() {
    if (audioQueue.length > 0) {
        isPlaying = true;
        const buffer = audioQueue.shift();
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();

        // 当当前音频块播放结束时，继续播放下一个
        source.onended = () => {
            if (audioQueue.length > 0) {
                playNextAudioInQueue();
            } else {
                isPlaying = false;  // 没有更多音频时停止
            }
        };
    }
  }

  const eventSource = new EventSource(`${skyoUrl}/generate_voice?request_id=${reqid}`);
  eventSource.onmessage = async (event) => {
    // console.info('Received data', event.data);
    if (event.data.includes("#done#")) {
      // eventSource.close();
    } else  {
       let audio_data = JSON.parse(event.data);
       if (audio_data.text.length > 0) {
            outputText.value += audio_data.text; // 在文本框中显示返回的文本
       }
       audio_data = audio_data['audio'];
       console.info('audio_data', audio_data.length);
       let binaryString = window.atob(audio_data);
       let binaryLen = binaryString.length;
       let audio_bytes = new Uint8Array(binaryLen);
       for (let i = 0; i < binaryLen; i++) {
         audio_bytes[i] = binaryString.charCodeAt(i);
       }

       const audioBuffer = await audioContext.decodeAudioData(audio_bytes.buffer);
       audioQueue.push(audioBuffer);

       if (play_counter == 0) {
        const current_play_time = new Date();
        const time_cost = (current_play_time - start_play_time) / 1000;
        document.getElementById('play-start-latency').innerText = `首播延迟: ${time_cost.toFixed(3)} 秒`;
     }

       total_play_time += audioBuffer.duration
       console.info('total_play_time', total_play_time, 'play_counter', play_counter);
       document.getElementById('total-play-duration').innerText = `总播时长: ${total_play_time.toFixed(3)} 秒`;
       play_counter += 1;
       const current_cost  = (new Date() - start_play_time) / 1000;
       document.getElementById('current-play-latency').innerText = `当前耗时: ${current_cost.toFixed(3)} 秒`;

       if (!isPlaying && audioQueue.length > 0) {
        playNextAudioInQueue();
       }

    }
  };

  // 监听错误事件
  eventSource.onerror = function(event) {
    console.info('Error in SSE', event);
    eventSource.close();
  };

}

// 处理文本发送
sendTextBtn.addEventListener('click', async () => {
  outputTextTT.value = '';
  const userInput = inputText.value;  // 获取用户输入的文本
  if (userInput.trim()) {
    const reqid = uuidv4();
    const text = encodeURIComponent(userInput);  // 将文本转为 base64 编码

    // 监听处理后的文本结果
    streamText(reqid, text);
  } else {
    console.warn('Input text is empty');
  }
});

// 通过 SSE 发送文本并接收处理结果
function streamText(reqid, encodedText) {
  console.info(`${skyoUrl}/generate_text_chat?request_id=${reqid}&text=${encodedText}`);
  const eventSource = new EventSource(`${skyoUrl}/generate_text_chat?request_id=${reqid}&text=${encodedText}`);

  // 接收到服务器发送的数据时触发
  eventSource.onmessage = function(event) {
    let textData = JSON.parse(event.data);
    console.info('Received data',textData);

    if (textData.text.length > 0) {
      outputTextTT.value += textData.text; // 在文本框中显示返回的文本
    }
  };

  // 当服务器结束流时触发
  eventSource.addEventListener("done", function() {
    console.info('Stream finished');
    eventSource.close();  // 关闭 SSE 连接
  });

  // 监听错误事件
  eventSource.onerror = function(event) {
    console.error('Error in SSE', event);
    eventSource.close();  // 关闭 SSE 连接
  };
}


// 处理文本发送
sendTextBtnTTS.addEventListener('click', async () => {
  const userInput = inputTextTTS.value;  // 获取用户输入的文本
  if (userInput.trim()) {
    const reqid = uuidv4();
    const text = encodeURIComponent(userInput);  // 将文本转为 base64 编码

    // 监听处理后的文本结果
    streamTTS(reqid, text);
  } else {
    console.warn('Input text is empty');
  }
});

function streamTTS(reqid, encodedText) {
  const audioContext = new AudioContext();
  const audioQueue = [];
  let isPlaying = false;

  console.info(`${skyoUrl}/generate_tts?request_id=${reqid}&text=${encodedText}`);
  const eventSource = new EventSource(`${skyoUrl}/generate_tts?request_id=${reqid}&text=${encodedText}`);

function playNextAudioInQueue() {
  if (audioQueue.length > 0) {
      isPlaying = true;
      const buffer = audioQueue.shift();
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.start();

      // 当当前音频块播放结束时，继续播放下一个
      source.onended = () => {
          if (audioQueue.length > 0) {
              playNextAudioInQueue();
          } else {
              isPlaying = false;  // 没有更多音频时停止
          }
      };
  }
}


eventSource.onmessage = async (event) => {
  // console.info('Received data', event.data);
  let audio_data = JSON.parse(event.data);
  audio_data = audio_data['audio'];
  console.info('audio_data', audio_data.length);
  let binaryString = window.atob(audio_data);
  let binaryLen = binaryString.length;
  let audio_bytes = new Uint8Array(binaryLen);
  for (let i = 0; i < binaryLen; i++) {
    audio_bytes[i] = binaryString.charCodeAt(i);
  }

  const audioBuffer = await audioContext.decodeAudioData(audio_bytes.buffer);
  audioQueue.push(audioBuffer);

  if (!isPlaying && audioQueue.length > 0) {
    playNextAudioInQueue();
  }
};
// 监听错误事件
eventSource.onerror = function(event) {
  console.error('Error in SSE', event);
  eventSource.close();  // 关闭 SSE 连接
};

eventSource.onended = function(event) {
  console.info('Stream finished');
  eventSource.close();  // 关闭 SSE 连接
};

}

  // 处理文件上传
fileInputASR.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  console.info('got asr file');
  if (file) {
    const base64Audio = await blobToBase64(file);
    await uploadAudio(base64Audio, 'asr');
  }
  fileInputASR.value = '';
  outputTextASR.value = '';
});

async function streamASR(reqid) {
  console.info(`${skyoUrl}/generate_asr?request_id=${reqid}`);
  const eventSource = new EventSource(`${skyoUrl}/generate_asr?request_id=${reqid}`);
  // 监听处理结果
  eventSource.onmessage = function(event) {
    let textData = JSON.parse(event.data);
    console.info('Received data',textData);

    if (textData.text.length > 0) {
      outputTextASR.value += textData.text; // 在文本框中显示返回的文本
    }

  };

  // 监听错误事件
  eventSource.onerror = function(event) {
    console.info('Error in SSE', event);
    eventSource.close();
  };
}
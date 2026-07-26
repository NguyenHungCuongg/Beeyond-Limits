/* global chrome */

import {
  createOffscreenAudioController,
  createOffscreenMessageHandler,
} from "./core/audio.js";

const controller = createOffscreenAudioController();
const handleMessage = createOffscreenMessageHandler(controller);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") {
    return false;
  }

  handleMessage(message).then(sendResponse);
  return true;
});

import { OpenAIChatProvider, ClaudeChatProvider } from './api.js';
import API_KEYS from './apiKeys.js';

// Log action on clicked event
chrome.action.onClicked.addListener(() => {
    console.log("Background::chrome.action.onClicked event triggered");
    chrome.tabs.create({
        url: chrome.runtime.getURL("popup.html")
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("Background::chrome.runtime.onMessage event received", request, sender);

    if (request.action === "sendApiRequest") {
        let aiChatProvider;
        console.log("sendApiRequest action triggered", request);

        if (request.AIName === ClaudeChatProvider.getClassName()) {
            aiChatProvider = new ClaudeChatProvider(API_KEYS.claude, request.model, request.context, request.prompt, request.imageUrl);
            console.log("Background::ClaudeChatProvider instantiated", request);
        } else if (request.AIName === OpenAIChatProvider.getClassName()) {
            aiChatProvider = new OpenAIChatProvider(API_KEYS.openAI, request.model, request.context, request.prompt, request.imageUrl);
            console.log("Background::OpenAIChatProvider instantiated", request);
        } else {
            sendResponse({ success: false, error: "Invalid model" });
            console.log("Background::Invalid model", request.model);
            return true;
        }

        aiChatProvider.sendRequest()
            .then(data => {
                sendResponse({ success: true, data });
                console.log("Background::API request successful", data);
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
                console.log("Background::API request failed", error.message);
            });

        // Return true to indicate that the response will be sent asynchronously
        return true;
    }
});
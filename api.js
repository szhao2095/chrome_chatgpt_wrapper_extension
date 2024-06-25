class AIChatProvider {
    constructor(apiKey, model, context, prompt, imageUrl = null) {
        if (new.target === AIChatProvider) {
            throw new TypeError("Cannot construct AIChatProvider instances directly");
        }
        this.apiKey = apiKey;
        this.name = this.constructor.getClassName();
        this.model = model;
        this.context = context;
        this.prompt = prompt;
        this.imageUrl = imageUrl;
    }

    preparePayload() {
        throw new Error("Must override method");
    }

    sendRequest() {
        throw new Error("Must override method");
    }

    getName() {
        return this.name;
    }

    static getClassName() {
        throw new Error("Must override static method");
    }
}

class OpenAIChatProvider extends AIChatProvider {
    constructor(apiKey, model, context, prompt, imageUrl) {
        super(apiKey, model, context, prompt, imageUrl);
    }

    preparePayload() {
        const systemMessage = { role: 'system', content: this.context };

        let userMessage;
        if (this.imageUrl) {
            userMessage = {
                role: 'user',
                content: [
                    { type: "text", text: this.prompt },
                    { type: "image_url", image_url: { url: this.imageUrl, detail: "low" } }
                ]
            };
        } else {
            userMessage = { role: 'user', content: this.prompt };
        }

        return JSON.stringify({
            model: this.model,
            max_tokens: 1024,
            messages: [systemMessage, userMessage]
        });
    }

    sendRequest() {
        const requestBody = this.preparePayload();
        return fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: requestBody
        })
        .then(response => response.json());
    }

    static getClassName() {
        return "OpenAIChatProvider";
    }
}

class ClaudeChatProvider extends AIChatProvider {
    constructor(apiKey, model, context, prompt, imageUrl) {
        super(apiKey, model, context, prompt, imageUrl);
    }

    preparePayload() {
        let userMessage;
        if (this.imageUrl) {
            userMessage = {
                role: 'user',
                content: [
                    { type: "text", text: this.prompt },
                    { type: "image",
                        "source": {
                          "type": "base64",
                          "media_type": "image/png",
                          "data": this.imageUrl.split(",")[1],
                        }
                    }
                ]
            };
        } else {
            userMessage = { role: 'user', content: this.prompt };
        }
        return JSON.stringify({
            model: this.model,
            max_tokens: 1024,
            messages: [
                { role: 'user', content: this.context },
                { role: 'assistant', content: "How may I help you today?" },
                userMessage
            ]
        });
    }

    sendRequest() {
        const requestBody = this.preparePayload();
        return fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: requestBody
        })
        .then(response => response.json());
    }

    static getClassName() {
        return "ClaudeChatProvider";
    }
}

export { OpenAIChatProvider, ClaudeChatProvider };
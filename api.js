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

export { OpenAIChatProvider };
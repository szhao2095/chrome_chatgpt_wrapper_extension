class Logger {
    constructor(debugMessagesDiv) {
        if (Logger.instance) {
            return Logger.instance;
        }

        this.debugMessagesDiv = debugMessagesDiv;
        Logger.instance = this;
    }

    static getInstance(debugMessagesDiv) {
        if (!Logger.instance) {
            Logger.instance = new Logger(debugMessagesDiv);
        } else if (debugMessagesDiv) {
            Logger.instance.debugMessagesDiv = debugMessagesDiv;
        }
        return Logger.instance;
    }

    logDebugMessage(...messages) {
        const message = messages.map(msg => JSON.stringify(msg)).join(' ');
        console.log(message);
        const div = document.createElement('div');
        div.textContent = message;
        this.debugMessagesDiv.appendChild(div);
    }

    clearDebugMessages() {
        this.debugMessagesDiv.innerHTML = '';
    }
}

export { Logger };
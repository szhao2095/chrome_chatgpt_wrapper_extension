document.addEventListener('DOMContentLoaded', () => {
    const promptNameInput = document.getElementById('promptName');
    const gptModelsSelect = document.getElementById('gptModels');
    const contextTextarea = document.getElementById('context');
    const promptTextarea = document.getElementById('prompt');
    const imageContainer = document.getElementById('imageContainer');
    const clearImageButton = document.getElementById('clearImage');

    const savePromptButton = document.getElementById('savePrompt');
    const savedPromptsSelect = document.getElementById('savedPrompts');
    const loadPromptButton = document.getElementById('loadPrompt');
    const setAsDefaultButton = document.getElementById('setAsDefault');
    const clearAllPresetsButton = document.getElementById('clearAllPresets');

    const usePromptButton = document.getElementById('query');
    const clearDebugMessagesButton = document.getElementById('clearDebugMessages');
    const responseDiv = document.getElementById('response');
    const debugMessagesDiv = document.getElementById('debugMessages');


    // Load saved prompts from storage
    chrome.storage.local.get(['prompts', 'defaultPromptIndex'], (result) => {
        const prompts = result.prompts || [];
        const defaultPromptIndex = result.defaultPromptIndex;

        logDebugMessage('Loaded prompts:', prompts);
        prompts.forEach((prompt, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = prompt.name;
            savedPromptsSelect.appendChild(option);
        });

        if (defaultPromptIndex !== undefined && prompts[defaultPromptIndex]) {
            savedPromptsSelect.value = defaultPromptIndex;
            loadPrompt(prompts[defaultPromptIndex]);
        }
    });

    // Save a new prompt or update existing prompt
    savePromptButton.addEventListener('click', () => {
        const promptName = promptNameInput.value;
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const selectedModel = gptModelsSelect.value;

        logDebugMessage('Saving prompt:', {
            name: promptName,
            context: context,
            prompt: prompt,
            model: selectedModel
        });

        if (promptName && context && prompt) {
            chrome.storage.local.get('prompts', (result) => {
                let prompts = result.prompts || [];
                const existingPromptIndex = prompts.findIndex(p => p.name === promptName);

                if (existingPromptIndex !== -1) {
                    // Update existing prompt
                    prompts[existingPromptIndex] = {
                        name: promptName,
                        context: context,
                        prompt: prompt,
                        model: selectedModel
                    };
                    logDebugMessage('Prompt updated:', prompts[existingPromptIndex]);
                } else {
                    // Add new prompt
                    prompts.push({
                        name: promptName,
                        context: context,
                        prompt: prompt,
                        model: selectedModel
                    });
                    logDebugMessage('Prompt added:', prompts[prompts.length - 1]);
                }

                chrome.storage.local.set({
                    prompts
                }, () => {
                    logDebugMessage('Prompts saved:', prompts);

                    // Update the dropdown menu
                    const optionExists = Array.from(savedPromptsSelect.options).some(option => option.value == existingPromptIndex);
                    if (!optionExists) {
                        const option = document.createElement('option');
                        option.value = prompts.length - 1;
                        option.text = promptName;
                        savedPromptsSelect.appendChild(option);
                    } else {
                        savedPromptsSelect.options[existingPromptIndex].text = promptName;
                    }

                    //                    promptNameInput.value = '';
                    //                    contextTextarea.value = '';
                    //                    promptTextarea.value = '';
                    //                    gptModelsSelect.value = 'gpt-3.5-turbo'; // Reset model to default or choose appropriate default
                    //                    imageContainer.innerHTML = 'Paste image here (Ctrl+V)';
                });
            });
        }
    });

    // Use the current prompt
    usePromptButton.addEventListener('click', () => {
        const context = contextTextarea.value;
        const prompt = promptTextarea.value;
        const model = gptModelsSelect.value;

        logDebugMessage('Using context:', context);
        logDebugMessage('Using prompt:', prompt);
        logDebugMessage('Selected model:', model);

        const imgElement = imageContainer.querySelector('img');

        if (imgElement) {
            logDebugMessage('Image found, adding to payload...');
            const imgSrc = imgElement.src;
            fetch(imgSrc)
                .then(response => response.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result;//.split(',')[1];
                        console.log("Image data: ", base64data)
                        const requestBody = {
                            model: model,
                            messages: [{
                                    role: 'system',
                                    content: context
                                },
                                {
                                    role: 'user',
                                    content: [{
                                            type: "text",
                                            text: prompt
                                        },
                                        {
                                            type: "image_url",
                                            image_url: {
                                                url: base64data,
                                                detail: "low"
                                            }
                                        }
                                    ]
                                }
                            ]
                        };
                        sendRequest(JSON.stringify(requestBody));
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error('Error:', error);
                    responseDiv.textContent = 'Error: ' + error.message;
                });
        } else {
            const requestBody = {
                model: model,
                messages: [{
                        role: 'system',
                        content: context
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            };
            sendRequest(JSON.stringify(requestBody));
        }
    });

    function sendRequest(requestBody) {
        responseDiv.textContent = "";
        logDebugMessage('\n\n===================== Sending payload: ', requestBody, " =====================\n\n");
        fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer sk-proj-byf35DMGz8sqL6Bh0CHsT3BlbkFJkVQYcPP8B0QbxGr4u6`
                },
                body: requestBody
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error.message);
                }
                logDebugMessage('API response:', data);
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    responseDiv.textContent = data.choices[0].message.content;
                } else {
                    responseDiv.textContent = 'Unexpected API response structure.';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                responseDiv.textContent = 'Error: ' + error.message;
            });
    }

    // Load selected prompt
    loadPromptButton.addEventListener('click', () => {
        const selectedIndex = savedPromptsSelect.value;
        if (selectedIndex !== '') {
            chrome.storage.local.get('prompts', (result) => {
                const prompts = result.prompts || [];
                const selectedPrompt = prompts[selectedIndex];
                if (selectedPrompt) {
                    logDebugMessage('Loading prompt:', selectedPrompt);
                    loadPrompt(selectedPrompt);
                }
            });
        }
    });

    // Set as default prompt
    setAsDefaultButton.addEventListener('click', () => {
        const selectedIndex = savedPromptsSelect.value;
        if (selectedIndex !== '') {
            chrome.storage.local.set({
                defaultPromptIndex: selectedIndex
            }, () => {
                logDebugMessage('Set default prompt index:', selectedIndex);
            });
        }
    });


    clearAllPresetsButton.addEventListener('click', () => {
        chrome.storage.local.remove('prompts', () => {
            logDebugMessage('All prompts cleared');
            savedPromptsSelect.innerHTML = '<option value="">Select a saved prompt</option>';
        });
    });


    // Handle image paste event
    imageContainer.addEventListener('paste', (event) => {
        const items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = document.createElement('img');
                    img.src = event.target.result;
                    logDebugMessage('Image pasted:', img.src);
                    imageContainer.innerHTML = ''; // Clear the container
                    imageContainer.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        }
    });

    // Clear image
    clearImageButton.addEventListener('click', () => {
        logDebugMessage('Clearing image');
        imageContainer.innerHTML = 'Paste image here (Ctrl+V)';
    });

    // Load prompt into input fields
    function loadPrompt(prompt) {
        promptNameInput.value = prompt.name;
        contextTextarea.value = prompt.context;
        promptTextarea.value = prompt.prompt;
        gptModelsSelect.value = prompt.model || 'gpt-3.5-turbo'; // Default if model is not defined
        imageContainer.innerHTML = 'Paste image here (Ctrl+V)'; // Clear the image area
    }

    // Log debug messages to the debug area
    function logDebugMessage(...messages) {
        const message = messages.map(msg => JSON.stringify(msg)).join(' ');
        console.log(message);
        const div = document.createElement('div');
        div.textContent = message;
        debugMessagesDiv.appendChild(div);
    }

    clearDebugMessagesButton.addEventListener('click', () => {
        debugMessagesDiv.innerHTML = '';
    });
});
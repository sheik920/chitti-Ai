require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({apiKey: "AIzaSy_dummy_key_to_pass_validation123"});
async function main() {
    const chat = ai.chats.create({ model: 'gemini-2.5-flash' });
    try {
        await chat.sendMessage({ 
            message: [{ functionResponse: { id: "123", name: "test", response: { result: "ok" } } }] 
        });
        console.log("Passed {message: [...] }");
    } catch(e) { console.log(e.message); }
}
main();

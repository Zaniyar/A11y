<div align="center">

# 🦾 A11y Copilot
### Adaptive Accessibility for the Web

**When "Disabled" Becomes Universal, Technology Must Adapt**

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chrome.google.com/webstore)
[![Built with React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Chrome AI](https://img.shields.io/badge/Chrome_AI-Experimental-FF6B00?style=for-the-badge&logo=google&logoColor=white)](https://developer.chrome.com/docs/ai/built-in)

*Barriers exist to be broken. Hands-free doesn't mean helpless. We all win when we design for everyone.*

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [APIs](#-apis-used) • [Documentation](#-documentation)

</div>

---

## 🌟 The Vision

A11y Copilot transforms how **everyone** interacts with the web. Not just "disabled users"—because we're all temporarily or situationally disabled. The parent holding a baby. The developer with a sprained wrist. The student reading in their second language. The professional working late with eye strain.

**This isn't an accessibility tool. This is the future of web interaction.**

## ✨ Features

### 🎯 Quick Ask AI
Select any text on any webpage. Get five powerful actions instantly:

- **💬 Ask** - Chat with the page. Ask questions, get answers in context
- **📝 Summarize** - Condense long articles into digestible summaries
- **✏️ Simplify** - Rewrite complex language into clear, simple text
- **🌐 Translate** - Instant translation to 75+ languages
- **🎤 Voice** - Speak your questions, hear the answers

### 👁️ Eye Control (Camera)
**Zero hand movement required.**
- Head-tracking mouse control using TrackyMouse
- Small circular camera view (bottom-right corner)
- Hover to click (dwell clicking)
- Auto-scroll when near screen edges
- Perfect for: Motor impairments, temporary injuries, hands-free browsing

### 🎨 High Contrast Mode
**One click for better visibility.**
- WCAG AAA compliant (21:1 contrast ratio)
- Yellow text on black background
- Larger fonts and better spacing
- Removes distracting animations
- Fixes navigation bar coverage

### 🗣️ Voice Control
**Completely hands-free interaction.**
- Speak your questions (Speech Recognition)
- Hear AI responses aloud (Text-to-Speech)
- Follow-up questions with voice
- Natural conversation flow
- Supports multiple languages

### 🎨 Beautiful UI
- **Markdown rendering** with syntax highlighting
- **Draggable dialogs** that never cover what you need
- **Persistent chat history** for natural conversations
- **Real-time streaming** responses
- **Minimalist design** that's invisible until needed

## 🚀 Installation

### Prerequisites
1. **Chrome/Chromium browser** (version 127+)
2. **Enable Chrome AI APIs**:
   - Navigate to `chrome://flags/#optimization-guide-on-device-model`
   - Set to "Enabled BypassPerfRequirement"
   - Navigate to `chrome://flags/#prompt-api-for-gemini-nano`
   - Set to "Enabled"
   - Restart Chrome
3. **Download the AI model**:
   - Open DevTools (F12) on any page
   - Go to Console
   - Type: `await ai.languageModel.create()`
   - Wait for the model to download (may take a few minutes)

### Install the Extension

#### Option 1: Build from Source
```bash
# Clone the repository
git clone git@github.com:Zaniyar/A11y.git
cd A11y

# Install dependencies
npm install -g pnpm
pnpm install

# Build the extension
pnpm build

# Load in Chrome
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the 'dist' folder
```

#### Option 2: Chrome Web Store (Coming Soon)
*Extension pending review*

### Grant Permissions
When first using features, you'll be prompted to grant:
- **Microphone** (for voice input)
- **Camera** (for eye control)

These permissions are only requested when you use the respective features.

## 🎮 Usage

### Quick Ask AI
1. **Select any text** on a webpage
2. **Widget appears** with 5 buttons
3. **Click an action**:
   - 💬 **Ask**: Opens chat dialog, ask anything about the selected text
   - 📝 **Summarize**: Get instant summary
   - ✏️ **Simplify**: Get simplified version
   - 🌐 **Translate**: Select language, get translation
   - 🎤 **Voice**: Speak your question, hear the answer

### Voice Mode
1. **Select text** (optional)
2. **Click 🎤 Voice button**
3. **Speak your question**
4. **Hear the answer** spoken aloud
5. **Ask follow-ups** using text or voice

### Eye Control
1. **Click 📷 Camera button** (next to Voice)
2. **Allow camera access**
3. **Calibrate** by looking at the screen
4. **Move your head** to control cursor
5. **Hover over buttons** to click automatically
6. **Move near edges** to auto-scroll

### High Contrast
1. **Click ⚪ Contrast button**
2. **Page transforms** to high contrast mode
3. **Click again** to toggle off

### Chat & Follow-ups
1. **Ask initial question** (text or voice)
2. **Type follow-up** in input field, or
3. **Click 🎤** in input field to speak follow-up
4. **AI remembers context** throughout conversation
5. **Drag dialog header** to reposition if needed

## 🤖 APIs Used

### Chrome Built-in AI (Experimental)
- **Prompt API** - General AI conversations
- **Summarizer API** - Text summarization
- **Rewriter API** - Text simplification
- **Translator API** - Language translation (75+ languages)
- **Language Detector API** - Automatic language detection

**Benefits**: Privacy-first (on-device), fast (no network), free, offline-capable

### Web Speech API
- **Speech Recognition** - Voice-to-text conversion
- **Speech Synthesis** - Text-to-speech conversion

### TrackyMouse API
- **Head tracking** with TensorFlow.js face mesh detection
- **Dwell clicking** for hands-free interaction

### Chrome Extension APIs
Content Scripts, Tabs, Storage, Runtime, Permissions

### Web Platform APIs
DOM, TreeWalker, Computed Styles, Blob, postMessage

[📖 Full API Documentation](Hackathon.md#which-apis-did-you-use)

## 🏗️ Technical Architecture

### 3-Layer AI Integration
```
┌─────────────────────────────────────┐
│     React UI Layer (TypeScript)     │  User Interface
├─────────────────────────────────────┤
│  Content Script Layer (Isolated)    │  Message Orchestration
├─────────────────────────────────────┤
│   Page Script Bridge (Page Context) │  Direct AI API Access
└─────────────────────────────────────┘
```

### Key Technologies
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Extension**: Chrome Manifest V3
- **AI**: Chrome Built-in AI APIs (Origin Trial)
- **Speech**: Web Speech API
- **Eye Control**: TrackyMouse + TensorFlow.js
- **Rendering**: react-markdown with custom components
- **Build**: Vite + Turborepo + pnpm

### Advanced Features
- Streaming responses with async generators
- Full page content extraction with TreeWalker
- Blob URL creation for Workers (CORS bypass)
- Worker constructor monkey-patching
- Drag-and-drop with viewport clamping
- Auto-scroll with edge detection
- CSP-compliant architecture

## 🎯 Who This Helps

### Motor Disabilities
- **Quadriplegia, cerebral palsy, ALS, muscular dystrophy**
- Full hands-free web browsing with eye control
- Voice-controlled navigation and interaction

### Cognitive Challenges
- **ADHD, dyslexia, autism, learning disabilities**
- Text simplification for better comprehension
- Summaries for information overload
- Clear, structured responses

### Visual Impairments
- **Low vision, color blindness, eye strain**
- High contrast mode (WCAG AAA)
- Text-to-speech for all content
- Larger, clearer typography

### Language Barriers
- **Non-native speakers, travelers, immigrants**
- 75+ language translation
- Automatic language detection
- Context-aware translations

### Temporary Situations
- **Broken arm, carpal tunnel, RSI, pregnancy**
- Holding a baby, eating, multitasking
- Eye strain from long reading sessions
- Any time hands aren't free

### Everyone
Because clarity, simplicity, and convenience benefit **all of us**.

## 📚 Documentation

- **[Hackathon Submission](Hackathon.md)** - Complete project story for hackathon judges
- **[About the Project](ABOUT_THE_PROJECT.md)** - Deep dive into inspiration and journey
- **[Prompt API Integration](PROMPT_API_INTEGRATION.md)** - Technical implementation guide
- **[Plan & Todos](PLAN_TODOS.md)** - Development roadmap and task tracking

## 🔧 Development

### Setup
```bash
# Install dependencies
pnpm install

# Development mode (with HMR)
pnpm dev

# Build for production
pnpm build

# Run linting
pnpm lint

# Run tests
pnpm test
```

### Project Structure
```
A11y_Chrome/
├── chrome-extension/        # Extension manifest and background scripts
│   ├── manifest.ts         # Extension configuration
│   ├── public/             # Static assets & bridge scripts
│   └── src/background/     # Background service worker
├── pages/                  # Extension pages
│   ├── content-ui/         # React UI injected into pages
│   ├── popup/              # Extension popup
│   └── options/            # Settings page
├── packages/               # Shared packages
│   ├── shared/             # Shared utilities
│   ├── storage/            # Storage helpers
│   └── ui/                 # UI components
└── dist/                   # Built extension
```

### Key Files
- **[App.tsx](pages/content-ui/src/matches/all/App.tsx)** - Main UI component (2200+ lines)
- **[ai-page-bridge.js](chrome-extension/public/ai-page-bridge.js)** - AI API bridge
- **[tracky-mouse-bridge.js](chrome-extension/public/tracky-mouse-bridge.js)** - Eye control bridge
- **[ai-services.ts](pages/content-ui/src/matches/all/ai-services.ts)** - AI service wrappers

## 🚀 Roadmap

### Immediate (v1.1)
- [ ] Enhanced eye control calibration
- [ ] Custom voice commands
- [ ] Keyboard shortcuts for all features
- [ ] Save and export conversations
- [ ] Reading mode with optimized typography

### Near Future (v1.5)
- [ ] Firefox extension
- [ ] Context awareness (remember preferences)
- [ ] Multi-page learning
- [ ] Proactive translation
- [ ] Custom simplification levels

### Long Term (v2.0)
- [ ] Mobile support (iOS/Android)
- [ ] Screen reader integration
- [ ] Switch control for single-button navigation
- [ ] Braille display output
- [ ] Developer API for third-party integration

### Research & Innovation
- [ ] AI model fine-tuning for accessibility
- [ ] Gaze prediction
- [ ] Emotion detection for adaptive tone
- [ ] Multimodal input (voice + eye + gesture)
- [ ] Neural interface support

[View Full Roadmap →](Hackathon.md#whats-next-for-a11y-copilot-adaptive-accessibility-for-the-web)

## 🤝 Contributing

We welcome contributions! Whether you're:
- Fixing bugs
- Adding features
- Improving documentation
- Sharing feedback
- Testing with assistive technologies

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code of Conduct
We're committed to providing a welcoming and inclusive environment. Please read our Code of Conduct before contributing.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

### Technologies
- **Chrome Built-in AI** team for pioneering on-device AI
- **TrackyMouse** for open-source head tracking
- **React** and **Vite** teams for amazing developer tools

### Inspiration
- **WHO ICF** (International Classification of Functioning)
- **W3C WAI** (Web Accessibility Initiative)
- **WCAG** (Web Content Accessibility Guidelines)
- Everyone who advocates for universal design

### Special Thanks
To everyone who believes that **barriers exist to be broken** and **we all win when we design for everyone**.

## 💬 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/Zaniyar/A11y/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Zaniyar/A11y/discussions)
- **Email**: [Your contact email]

## ⭐ Star History

If this project helps you, please consider giving it a star! ⭐

It helps others discover the project and motivates us to keep improving it.

---

<div align="center">

**Built with ❤️ for everyone, everywhere, always.**

*"Accessibility isn't charity—it's empathy."*

[⬆ Back to Top](#-a11y-copilot)

</div>

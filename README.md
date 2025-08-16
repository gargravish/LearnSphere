# LearnSphere: The Interactive PDF Scholar

A Chrome extension that transforms static PDF documents into dynamic, interactive learning environments using AI-powered assistance.

## Features

### 🎯 Core Features
- **PDF Viewer Integration**: Override Chrome's default PDF viewer with enhanced functionality
- **Text & Area Selection**: Select text or draw bounding boxes around diagrams, charts, and equations
- **Contextual AI Chat**: Ask questions about selected content with strict RAG (Retrieval Augmented Generation)
- **Study Aid Generation**: Create summaries, flashcards, and multiple-choice quizzes
- **Local-First Architecture**: All data stored locally for privacy and offline functionality

### 🧠 AI-Powered Learning
- **Gemini Integration**: Powered by Google's Gemini AI for accurate, context-aware responses
- **Multimodal Understanding**: Analyze text, diagrams, charts, and equations
- **Strict Grounding**: AI responses are constrained to the PDF content only
- **Personalized Learning**: Track progress and identify knowledge gaps

### 📊 Learning Analytics
- **Local Database**: IndexedDB for storing learning progress and analytics
- **Knowledge Gap Analysis**: Identify areas that need improvement
- **Progress Tracking**: Monitor quiz performance and learning patterns
- **Personalized Dashboard**: View learning statistics and recommendations

## Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd LearnSphere_CE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the extension**
   ```bash
   npm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from this project

### Production Installation

1. Download the latest release from the releases page
2. Extract the ZIP file
3. Follow steps 4-6 from the development setup above

## Usage

### Getting Started

1. **Open a PDF**: Navigate to any PDF file in Chrome
2. **Select Content**: 
   - Highlight text to ask questions about it
   - Hold Alt and drag to select areas (diagrams, charts, etc.)
3. **Ask Questions**: Click "Ask LearnSphere" to open the chat sidebar
4. **Generate Study Aids**: Use the extension popup to create summaries and quizzes

### Features Overview

#### Text Selection
- Simply highlight any text in the PDF
- A "Ask LearnSphere" prompt will appear
- Click to open the chat with the selected text as context

#### Area Selection
- Hold the Alt key and drag to create a selection box
- Perfect for diagrams, charts, equations, and images
- The AI will analyze the visual content within the selection

#### Chat Interface
- Ask questions about the selected content
- Get explanations, clarifications, and additional context
- All responses are grounded in the PDF content only

#### Study Aids
- **Summaries**: Generate brief or detailed summaries of pages, chapters, or entire documents
- **Quizzes**: Create multiple-choice questions with plausible distractors
- **Flashcards**: Generate term-definition pairs for key concepts

#### Learning Dashboard
- View your learning progress and statistics
- Identify knowledge gaps and weak areas
- Get personalized revision recommendations

## Development

### Project Structure

```
LearnSphere_CE/
├── src/
│   ├── components/          # Reusable React components
│   ├── pages/              # Page components (popup, options)
│   ├── services/           # API and service layer
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript type definitions
│   ├── content/            # Content script for PDF interaction
│   ├── background/         # Background service worker
│   └── manifest.json       # Chrome extension manifest
├── public/                 # Static assets
├── dist/                   # Built extension files
└── .taskmaster/           # Task management files
```

### Technology Stack

- **Frontend**: React 18, TypeScript
- **Build Tool**: Webpack 5
- **PDF Processing**: PDF.js
- **Local Database**: IndexedDB with Dexie.js
- **AI Integration**: Google Gemini API
- **Styling**: CSS with modern design principles

### Development Commands

```bash
# Development mode with hot reloading
npm run dev

# Production build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
```

### Task Management

This project uses Taskmaster for development workflow management. See the `.taskmaster/` directory for task definitions and progress tracking.

## Configuration

### Settings

Access the extension settings by:
1. Right-clicking the extension icon
2. Selecting "Options"
3. Or clicking "Settings" in the extension popup

Available settings:
- **AI Model**: Choose between Gemini Pro and Gemini Ultra
- **Theme**: Light, Dark, or Auto (system preference)
- **Language**: Interface language selection
- **Auto-save**: Automatically save learning progress
- **Cloud Sync**: Enable cross-device synchronization (optional)
- **Notifications**: Enable learning reminders

### API Configuration

To use the AI features, you'll need to configure the Gemini API:

1. Get a Google Cloud API key with Vertex AI access
2. Add the API key to your environment variables
3. Configure the extension to use your API key

## Privacy & Security

### Local-First Approach
- All learning data is stored locally in your browser
- No data is sent to external servers unless you enable cloud sync
- Your PDF content is processed locally for AI interactions

### Data Storage
- **Local Storage**: Learning progress, quiz results, chat history
- **Sync Storage**: User preferences and settings
- **Cloud Storage**: Optional backup and cross-device sync (opt-in only)

### Security Features
- Encrypted data transmission for AI API calls
- No PDF content is used for model training
- Clear data management controls
- Transparent privacy practices

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests for new features
- Maintain consistent code style
- Update documentation for new features
- Follow the existing project structure

## Roadmap

### Phase 1: MVP (Current)
- ✅ Basic Chrome extension structure
- ✅ PDF viewer integration
- ✅ Text selection and highlighting
- 🔄 AI integration with Gemini
- 🔄 Study aid generation

### Phase 2: Multimodal Enhancement
- Area selection for diagrams and charts
- Enhanced AI understanding of visual content
- Concept visualization features
- Flashcard generation and export

### Phase 3: Learning Engine
- Advanced knowledge gap analysis
- Personalized learning recommendations
- Progress tracking and analytics
- Revision planning system

### Phase 4: Cloud Services
- Optional cloud synchronization
- Cross-device learning continuity
- Advanced analytics and insights
- Collaborative learning features

## Support

### Getting Help
- Check the [Issues](https://github.com/your-repo/issues) page for known problems
- Create a new issue for bugs or feature requests
- Review the documentation for usage questions

### Troubleshooting

**Extension not loading PDFs:**
- Ensure you're on a PDF page (URL ends with .pdf)
- Check that the extension is enabled
- Try refreshing the page

**AI features not working:**
- Verify your API key is configured correctly
- Check your internet connection
- Ensure you have sufficient API quota

**Data not saving:**
- Check browser storage permissions
- Ensure auto-save is enabled in settings
- Clear browser cache if needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini AI for providing the AI capabilities
- PDF.js for PDF rendering and processing
- Chrome Extensions team for the excellent platform
- All contributors and beta testers

---

**LearnSphere** - Transform your PDF learning experience with AI-powered assistance.

# ElevenVoiceReader

A professional Chrome/Brave extension that transforms selected text into natural, human-like speech using ElevenLabs' advanced AI voice synthesis technology. Perfect for accessibility, content consumption, and productivity.

## ✨ Features

- **🎯 Smart Text Selection**: Highlight any text on any webpage and read it aloud instantly
- **🎭 20+ Premium AI Voices**: Choose from a diverse range of high-quality voices including celebrities and characters
- **🎨 Professional Dark Theme**: Sleek, modern UI designed for finance and professional environments
- **🔐 Secure API Management**: Persistent storage of ElevenLabs API keys with easy setup flow
- **🎮 Intuitive Controls**: Play, pause, stop, and adjust volume/speed with a draggable interface
- **⚡ Fast Generation**: Real-time audio synthesis with minimal latency
- **🔄 Seamless Restart**: Resume playback from any point without re-generating audio
- **📱 Responsive Design**: Works across different screen sizes and zoom levels

## 🚀 Installation

### For Development/Testing:
1. Clone or download this repository
2. Open in VS Code
3. Navigate to `chrome://extensions/` (or `brave://extensions/`)
4. Enable "Developer mode" (toggle in top-right)
5. Click "Load unpacked" and select the project folder
6. Pin the extension to your toolbar for easy access

### For Production Use:
- Package the extension and upload to Chrome Web Store
- Or distribute as a .zip file for manual installation

## ⚙️ Setup & Configuration

### API Key Setup:
1. Visit [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) and create an account
2. Generate a new API key
3. Click the extension icon in your browser toolbar
4. Click "Settings" or the gear icon
5. Enter your API key and click "Test API Key"
6. Select your preferred voice from the dropdown
7. Click "Save Settings"

### Voice Customization:
- Adjust voice stability and similarity in the settings (coming in future updates)
- Default settings provide natural, clear speech

## 📖 Usage Guide

### Basic Reading:
1. Navigate to any webpage with text content
2. Highlight/select the text you want to hear
3. Right-click and select "🔊 Read Aloud with ElevenVoiceReader"
4. The reading interface will appear with controls

### Advanced Controls:
- **▶ Play/Pause**: Toggle audio playback
- **⏹ Stop**: Stop and reset audio (allows restart)
- **🔊 Volume**: Adjust playback volume (0-100%)
- **⏩ Speed**: Control reading speed (0.5x - 2x)
- **✕ Close**: Dismiss the reading interface

### Keyboard Shortcuts:
- Currently supports right-click context menu
- Future updates may include keyboard shortcuts

## 🛠️ Technical Details

### Architecture:
- **Manifest V3**: Modern Chrome extension standard
- **Service Worker**: Background processing for context menus
- **Content Scripts**: DOM manipulation and audio playback
- **Web Audio API**: High-quality audio handling
- **Chrome Storage**: Persistent settings and API keys

### File Structure:
```
ElevenVoiceReader/
├── manifest.json          # Extension manifest
├── package.json           # Project metadata
├── README.md             # This file
├── icons/                # Extension icons (16x16, 48x48, 128x128)
└── src/
    ├── background.js     # Context menu and API calls
    ├── content.js        # Main UI and audio logic
    ├── content.css       # Legacy styles (deprecated)
    ├── popup/
    │   ├── popup.html    # Extension popup
    │   └── popup.js      # Popup functionality
    ├── options/
    │   ├── options.html  # Settings page
    │   └── options.js    # Settings logic
    └── components/
        ├── ui/
        │   ├── ReadingUI.css    # Main UI styles
        │   └── ReadingUI.js     # UI component (reference)
        └── modals/
            ├── index.css        # Shared modal styles
            ├── ApiKeyPrompt.css # API key modal styles
            ├── VoiceSelectPrompt.css # Voice selection styles
            └── [component files]
```

### Dependencies:
- **ElevenLabs API**: For voice synthesis
- **Web Audio API**: For audio playback
- **Chrome Extensions API**: For storage, scripting, and UI

## 🔧 Troubleshooting

### Common Issues:

**❌ No Audio Playback:**
- Check browser console (F12) for error messages
- Verify your ElevenLabs API key is valid and has credits
- Ensure stable internet connection
- Try reloading the extension

**❌ Context Menu Not Appearing:**
- Reload the extension in `chrome://extensions/`
- Refresh the webpage
- Check if text is properly selected

**❌ Extension Not Loading:**
- Verify all files are present in the correct structure
- Check manifest.json for syntax errors
- Ensure you're loading the root folder, not a subfolder

**❌ Audio Quality Issues:**
- Check your internet speed
- Try different voices
- Adjust volume settings

### Debug Mode:
- Open browser DevTools (F12)
- Check Console tab for extension logs
- Look for messages starting with `**ElevenVoiceReader**`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup:
- Use VS Code with Chrome Extensions development tools
- Test on multiple websites and browsers
- Follow the existing code style and structure

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **ElevenLabs**: For providing exceptional AI voice technology
- **Chrome Extensions Team**: For the robust extension platform
- **Open Source Community**: For inspiration and best practices

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/elevenvoicereader/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/elevenvoicereader/discussions)
- **ElevenLabs Support**: For API-related questions

---

**Enjoy distraction-free, natural reading experiences! 🎧✨**

*Made with ❤️ for accessibility and productivity*
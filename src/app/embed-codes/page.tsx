"use client";

import { useState } from 'react';

export default function EmbedCodesPage() {
    const [selectedSize, setSelectedSize] = useState('medium');
    const [selectedTheme, setSelectedTheme] = useState('light');
    const [pollId, setPollId] = useState('');
    
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const singlePollUrl = `${baseUrl}/embed/poll`;
    
    const singlePollSizes = {
        small: { width: '350px', height: '400px' },
        medium: { width: '500px', height: '600px' },
        large: { width: '700px', height: '800px' },
        full: { width: '100%', height: '500px' }
    };
    
    const themes = {
        light: '',
        dark: '?theme=dark'
    };
    
    const currentSize = singlePollSizes[selectedSize];
    const currentTheme = themes[selectedTheme];
    const fullEmbedUrl = `${singlePollUrl}/${pollId}${currentTheme}`;
    
    const iframeCode = `<iframe 
  src="${fullEmbedUrl}"
  width="${currentSize.width}"
  height="${currentSize.height}"
  frameborder="0"
  scrolling="no"
  style="border: 1px solid #ddd; border-radius: 8px;"
  title="xilotto - Decentralized Voting"
></iframe>`;

    const htmlCode = `<div style="width: ${currentSize.width}; height: ${currentSize.height};">
  <iframe 
    src="${fullEmbedUrl}"
    width="100%"
    height="100%"
    frameborder="0"
    scrolling="no"
    style="border: 1px solid #ddd; border-radius: 8px;"
    title="xilotto - Decentralized Voting"
  ></iframe>
</div>`;

    return (
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
            <div className="embed-codes-page">
                <h1>Embed Individual Polls</h1>
                <p className="description">
                    Embed specific polls on your website with our embeddable widget. 
                    Users can view and vote on individual polls directly from your site.
                </p>

                <div className="poll-id-input">
                    <h3>Poll ID</h3>
                    <input
                        type="text"
                        placeholder="Enter poll ID (e.g., 1, 2, 3...)"
                        value={pollId}
                        onChange={(e) => setPollId(e.target.value)}
                        className="poll-id-field"
                    />
                    <small>Find the poll ID in the URL when viewing a poll: /poll/[ID]</small>
                </div>

                <div className="embed-options">
                    <div className="option-group">
                        <h3>Size</h3>
                        <div className="size-options">
                            {Object.entries(singlePollSizes).map(([key, size]) => (
                                <label key={key} className="size-option">
                                    <input
                                        type="radio"
                                        name="size"
                                        value={key}
                                        checked={selectedSize === key}
                                        onChange={(e) => setSelectedSize(e.target.value)}
                                    />
                                    <span className="size-label">
                                        {key.charAt(0).toUpperCase() + key.slice(1)}
                                        <small>{size.width} × {size.height}</small>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="option-group">
                        <h3>Theme</h3>
                        <div className="theme-options">
                            <label className="theme-option">
                                <input
                                    type="radio"
                                    name="theme"
                                    value="light"
                                    checked={selectedTheme === 'light'}
                                    onChange={(e) => setSelectedTheme(e.target.value)}
                                />
                                <span>Light</span>
                            </label>
                            <label className="theme-option">
                                <input
                                    type="radio"
                                    name="theme"
                                    value="dark"
                                    checked={selectedTheme === 'dark'}
                                    onChange={(e) => setSelectedTheme(e.target.value)}
                                />
                                <span>Dark</span>
                            </label>
                        </div>
                    </div>
                </div>

                {!pollId && (
                    <div className="preview-placeholder">
                        <h3>Preview</h3>
                        <div className="placeholder-message">
                            <p>Enter a poll ID above to see the preview</p>
                        </div>
                    </div>
                )}

                {pollId && (
                    <div className="preview-section">
                        <h3>Preview</h3>
                        <div className="preview-container" style={{ width: currentSize.width, height: currentSize.height }}>
                            <iframe 
                                src={fullEmbedUrl}
                                width="100%"
                                height="100%"
                                frameBorder="0"
                                scrolling="no"
                                style={{ border: '1px solid #ddd', borderRadius: '8px' }}
                                title="xilotto - Decentralized Voting"
                            />
                        </div>
                    </div>
                )}

                {pollId && (
                    <div className="code-section">
                        <h3>Embed Code</h3>
                        <div className="code-tabs">
                            <button className="tab-btn active">Iframe</button>
                            <button className="tab-btn">HTML Container</button>
                        </div>
                        <div className="code-container">
                            <pre className="code-block">
                                <code>{iframeCode}</code>
                            </pre>
                            <button 
                                className="copy-btn"
                                onClick={() => navigator.clipboard.writeText(iframeCode)}
                            >
                                Copy Code
                            </button>
                        </div>
                    </div>
                )}

                <div className="instructions">
                    <h3>How to Use</h3>
                    <ol>
                        <li>Enter the poll ID you want to embed</li>
                        <li>Select your preferred size and theme</li>
                        <li>Copy the embed code</li>
                        <li>Paste it into your website&apos;s HTML where you want the poll to appear</li>
                        <li>The widget will automatically load and display the poll</li>
                        <li>Users can vote directly from your website (requires Xian wallet connection)</li>
                    </ol>

                    <h3>Features</h3>
                    <ul>
                        <li>✅ Real-time voting and results</li>
                        <li>✅ Mobile responsive design</li>
                        <li>✅ Secure blockchain voting</li>
                        <li>✅ No registration required</li>
                        <li>✅ Automatic updates</li>
                        <li>✅ Individual poll embedding</li>
                        <li>✅ Focused voting interface</li>
                    </ul>

                    <h3>Requirements</h3>
                    <ul>
                        <li>Users need a Xian wallet to vote</li>
                        <li>Modern web browser with JavaScript enabled</li>
                        <li>Internet connection for real-time updates</li>
                    </ul>
                </div>
            </div>
        </div>
    );
} 
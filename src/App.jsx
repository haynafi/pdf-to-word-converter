import React, { useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun } from 'docx';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export default function App() {
  const [extractedText, setExtractedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  const extractTextFromPDF = async (file) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      const totalPages = pdf.numPages;
      
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        if (i > 1) {
          fullText += '\n\n━━━ PAGE ' + i + ' ━━━\n\n';
        }
        
        const lines = {};
        textContent.items.forEach(item => {
          const y = Math.round(item.transform[5]);
          if (!lines[y]) {
            lines[y] = [];
          }
          lines[y].push({
            text: item.str,
            x: item.transform[4],
            width: item.width
          });
        });
        
        const sortedY = Object.keys(lines).sort((a, b) => b - a);
        
        let previousY = null;
        sortedY.forEach(y => {
          if (previousY !== null && previousY - y > 10) {
            fullText += '\n';
          }
          
          const lineItems = lines[y].sort((a, b) => a.x - b.x);
          
          let lineText = '';
          let lastX = 0;
          lineItems.forEach((item, idx) => {
            if (idx > 0 && item.x - lastX > 5) {
              lineText += ' ';
            }
            lineText += item.text;
            lastX = item.x + item.width;
          });
          
          fullText += lineText.trim() + '\n';
          previousY = y;
        });
      }
      
      setExtractedText(fullText.trim());
      setFileName(file.name.replace('.pdf', ''));
    } catch (error) {
      alert('PDF extraction failed: ' + error.message);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (file) => {
    if (file && file.type === 'application/pdf') {
      extractTextFromPDF(file);
    } else {
      alert('Please upload a valid PDF file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const generateWordDoc = async () => {
    if (!extractedText && !editorRef.current?.innerText) {
      alert('No content to convert');
      return;
    }

    setIsProcessing(true);
    try {
      const content = editorRef.current?.innerText || extractedText;
      
      const lines = content.split('\n');
      const children = [];
      
      lines.forEach(line => {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('━━━ PAGE')) {
          children.push(
            new Paragraph({
              text: '',
              pageBreakBefore: true,
            })
          );
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  bold: true,
                  size: 24,
                })
              ],
              spacing: { after: 200 },
            })
          );
          return;
        }
        
        const isHeading = /^\d+\.\s+[A-Z]/.test(trimmedLine) || 
                        /^[A-Z][A-Z\s]+:?$/.test(trimmedLine);
        
        const isBullet = /^[•\-*]\s+/.test(trimmedLine);
        
        if (trimmedLine === '') {
          children.push(
            new Paragraph({
              text: '',
              spacing: { after: 100 },
            })
          );
          return;
        }
        
        if (isHeading) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  bold: true,
                  size: 28,
                })
              ],
              spacing: { before: 200, after: 100 },
            })
          );
        } else if (isBullet) {
          children.push(
            new Paragraph({
              text: trimmedLine.replace(/^[•\-*]\s+/, ''),
              bullet: { level: 0 },
              spacing: { after: 50 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: [new TextRun(trimmedLine)],
              spacing: { after: 100 },
            })
          );
        }
      });

      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: children,
        }],
      });

      const blob = await Packer.toBlob(doc);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName || 'converted'}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      alert('Word generation failed: ' + error.message);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-yellow-300 flex items-center justify-center p-8">
      <div className="w-full max-w-4xl bg-white border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
        
        <div className="bg-black text-white p-6 border-b-8 border-black">
          <h1 className="text-4xl font-black uppercase tracking-tight">
            PDF → WORD CONVERTER
          </h1>
          <p className="text-sm font-mono mt-2 opacity-80">
            CLIENT-SIDE ONLY. ZERO SERVER UPLOADS.
          </p>
        </div>

        {!extractedText && (
          <div className="p-8">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-8 border-dashed border-black p-16 text-center cursor-pointer
                transition-colors duration-200
                ${isDragging ? 'bg-gray-200' : 'bg-gray-50 hover:bg-gray-100'}
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => handleFileSelect(e.target.files[0])}
                className="hidden"
              />
              
              <div className="text-6xl mb-4">📄</div>
              <p className="text-2xl font-black uppercase mb-2">
                DROP YOUR PDF HERE
              </p>
              <p className="text-sm font-mono">
                OR CLICK TO BROWSE
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="
                w-full mt-6 bg-[#FF5733] text-white font-black text-xl uppercase
                py-4 border-4 border-black
                shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                active:translate-x-1 active:translate-y-1
                transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {isProcessing ? 'PROCESSING...' : 'UPLOAD PDF'}
            </button>
          </div>
        )}

        {extractedText && (
          <div className="p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-black text-xl uppercase">LIVE EDITOR</p>
                <p className="font-mono text-sm text-gray-600">{fileName}.pdf</p>
              </div>
              <button
                onClick={() => {
                  setExtractedText('');
                  setFileName('');
                }}
                className="
                  bg-gray-800 text-white font-bold uppercase px-4 py-2
                  border-4 border-black text-sm
                  shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
                  active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                  active:translate-x-1 active:translate-y-1
                  transition-all
                "
              >
                RESET
              </button>
            </div>

            <div
              ref={editorRef}
              contentEditable={true}
              suppressContentEditableWarning={true}
              className="
                w-full min-h-[400px] p-6 
                border-8 border-black bg-white
                font-mono text-base leading-relaxed
                focus:outline-none focus:ring-0
                overflow-y-auto
              "
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {extractedText}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  if (editorRef.current) {
                    editorRef.current.innerText = extractedText;
                  }
                }}
                className="
                  bg-gray-200 text-black font-black text-lg uppercase
                  py-4 border-4 border-black
                  shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                  active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                  active:translate-x-1 active:translate-y-1
                  transition-all
                "
              >
                RESTORE ORIGINAL
              </button>

              <button
                onClick={generateWordDoc}
                disabled={isProcessing}
                className="
                  bg-[#3357FF] text-white font-black text-lg uppercase
                  py-4 border-4 border-black
                  shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]
                  active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                  active:translate-x-1 active:translate-y-1
                  transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {isProcessing ? 'GENERATING...' : '⬇ DOWNLOAD WORD'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-black text-white p-4 text-center border-t-8 border-black">
          <p className="font-mono text-sm uppercase tracking-widest">
            PRIVATE. LOCAL. BRUTAL.
          </p>
        </div>
      </div>
    </div>
  );
}
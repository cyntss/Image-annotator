// ImageAnnotator.js
import React, { useState, useRef, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Slider,
  Box,
  ToggleButton,
  ToggleButtonGroup,
  CssBaseline,
} from '@mui/material';
import OpenInBrowserIcon from '@mui/icons-material/OpenInBrowser';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CropIcon from '@mui/icons-material/Crop';
import BrushIcon from '@mui/icons-material/Brush';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import RefreshIcon from '@mui/icons-material/Refresh';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme();
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export default function ImageAnnotator() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [img, setImg] = useState(null);
  const [scale, setScale] = useState(1);
  const [mode, setMode] = useState('draw');
  const [color, setColor] = useState('#ff0000');
  const [penWidth, setPenWidth] = useState(5);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(24);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [texts, setTexts] = useState([]);

  useEffect(() => {
    const handlePaste = (e) => {
      if (!containerRef.current.contains(document.activeElement)) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          const url = URL.createObjectURL(blob);
          const im = new Image();
          im.onload = () => {
            setImg(im);
            fitToScreen(im);
            resetHistory(im);
            URL.revokeObjectURL(url);
          };
          im.src = url;
          e.preventDefault();
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  useEffect(() => drawCanvas(), [img, texts]);

  function fitToScreen(image) {
    const f = Math.min(
      window.innerWidth / image.width,
      window.innerHeight / image.height,
      1
    );
    setScale(f);
  }

  function resetHistory(image) {
    setUndoStack(image ? [image] : []);
    setRedoStack([]);
    setTexts([]);
  }

  function pushState() {
    const canvas = canvasRef.current;
    requestAnimationFrame(() => {
      const dataUrl = canvas.toDataURL();
      const copy = new Image();
      copy.onload = () => {
        setUndoStack((us) => [...us, copy]);
        setRedoStack([]);
        setImg(copy);
      };
      copy.src = dataUrl;
    });
  }

  function undo() {
    if (undoStack.length < 2) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((rs) => [last, ...rs]);
    const prev = undoStack[undoStack.length - 2];
    setUndoStack((us) => us.slice(0, us.length - 1));
    setImg(prev);
  }

  function redo() {
    if (!redoStack.length) return;
    const [first, ...rest] = redoStack;
    setUndoStack((us) => [...us, first]);
    setRedoStack(rest);
    setImg(first);
  }

  function handleOpen() {
    fileInputRef.current.click();
  }

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      setImg(im);
      fitToScreen(im);
      resetHistory(im);
      URL.revokeObjectURL(url);
    };
    im.src = url;
  }

  function handleSave() {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'annotated.jpg';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/jpeg');
  }

  function handleCopy() {
    canvasRef.current.toBlob((blob) => {
      const item = new ClipboardItem({ [blob.type]: blob });
      navigator.clipboard.write([item]);
    });
  }

  function resetCanvas() {
    // Clear everything and reset to blank canvas
    setImg(null);
    resetHistory(null);
  }

  function getCanvasCoords(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = img ? img.width : DEFAULT_WIDTH;
    const h = img ? img.height : DEFAULT_HEIGHT;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    if (img) ctx.drawImage(img, 0, 0);
    texts.forEach((t) => {
      ctx.font = `${t.fontSize}px ${t.fontFamily}`;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    });
  }

  function startDraw(e) {
    if (mode !== 'draw') return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    const start = getCanvasCoords(e);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    function onMove(ev) {
      const point = getCanvasCoords(ev);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      pushState();
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleCanvasMouseDown(e) {
    if (mode === 'draw') {
      startDraw(e);
      return;
    }
    if (mode === 'text') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const start = getCanvasCoords(e);
      let hit = null;
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        ctx.font = `${t.fontSize}px ${t.fontFamily}`;
        const w = ctx.measureText(t.text).width;
        const h = t.fontSize;
        if (
          start.x >= t.x &&
          start.x <= t.x + w &&
          start.y >= t.y - h &&
          start.y <= t.y
        ) {
          hit = t;
          break;
        }
      }
      if (hit) {
        const { id, x: ox, y: oy } = hit;
        const anchor = getCanvasCoords(e);
        function onMove(ev) {
          const point = getCanvasCoords(ev);
          const dx = point.x - anchor.x;
          const dy = point.y - anchor.y;
          setTexts((ts) =>
            ts.map((tt) =>
              tt.id === id ? { ...tt, x: ox + dx, y: oy + dy } : tt
            )
          );
        }
        function onUp() {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          pushState();
        }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      } else {
        const txt = prompt('Enter text:');
        if (txt) {
          const { x, y } = start;
          const id = Date.now();
          setTexts((ts) => [
            ...ts,
            { id, text: txt, x, y, fontFamily, fontSize, color },
          ]);
          pushState();
        }
      }
    }
  }

  function handleModeChange(_, val) {
    if (val) setMode(val);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box ref={containerRef} tabIndex={0} sx={{ outline: 'none' }}>
        <AppBar
          position='static'
          sx={{ backgroundColor: '#f5f5f5', color: '#000' }}
        >
          <Toolbar variant='dense'>
            <input
              type='file'
              accept='image/*'
              hidden
              ref={fileInputRef}
              onChange={onFileChange}
            />
            <Tooltip title='Open'>
              <IconButton color='inherit' onClick={handleOpen}>
                <OpenInBrowserIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title='Save as JPEG'>
              <IconButton color='inherit' onClick={handleSave}>
                <SaveIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title='Copy to clipboard'>
              <IconButton color='inherit' onClick={handleCopy}>
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title='Undo'>
              <span>
                <IconButton
                  color='inherit'
                  onClick={undo}
                  disabled={undoStack.length < 2}
                >
                  <UndoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title='Redo'>
              <span>
                <IconButton
                  color='inherit'
                  onClick={redo}
                  disabled={!redoStack.length}
                >
                  <RedoIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Box sx={{ width: 120, mx: 2 }}>
              <Tooltip title='Brush size'>
                <Slider
                  value={penWidth}
                  min={1}
                  max={50}
                  onChange={(_, v) => setPenWidth(v)}
                />
              </Tooltip>
            </Box>
            <Box sx={{ mx: 2, display: 'flex', alignItems: 'center' }}>
              <Tooltip title='Pick color'>
                <input
                  type='color'
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  style={{
                    width: 32,
                    height: 32,
                    border: 'none',
                    padding: 0,
                    background: 'none',
                    cursor: 'pointer',
                  }}
                />
              </Tooltip>
            </Box>
            <ToggleButtonGroup
              value={mode}
              exclusive
              onChange={handleModeChange}
              sx={{ mx: 2 }}
            >
              <ToggleButton value='draw'>
                <Tooltip title='Draw'>
                  <BrushIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value='text'>
                <Tooltip title='Text'>
                  <TextFieldsIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value='crop'>
                <Tooltip title='Crop'>
                  <CropIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title='Reset Canvas'>
              <IconButton color='inherit' onClick={resetCanvas}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
        <Box
          component='canvas'
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          sx={{
            display: 'block',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: `${DEFAULT_WIDTH * scale}px`,
            height: `${DEFAULT_HEIGHT * scale}px`,
            border: '1px solid #ccc',
            m: 'auto',
            mt: 2,
          }}
        />
      </Box>
    </ThemeProvider>
  );
}

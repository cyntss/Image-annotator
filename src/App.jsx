// ImageAnnotator.js
import React, { useState, useRef, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Tooltip,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme();

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

  useEffect(drawCanvas, [img, undoStack, redoStack]);

  function fitToScreen(image) {
    const f = Math.min(
      window.innerWidth / image.width,
      window.innerHeight / image.height,
      1
    );
    setScale(f);
  }

  function resetHistory(image) {
    setUndoStack([image]);
    setRedoStack([]);
  }

  function pushState() {
    const canvas = canvasRef.current;
    const copy = new Image();
    copy.onload = () => {
      setUndoStack((us) => [...us, copy]);
      setRedoStack([]);
    };
    copy.src = canvas.toDataURL();
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

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    // replay current top of undoStack if necessary
    if (undoStack.length > 1) {
      const lastState = new Image();
      lastState.src = undoStack[undoStack.length - 1].src;
      lastState.onload = () => ctx.drawImage(lastState, 0, 0);
    }
  }

  function startDraw(e) {
    if (mode !== 'draw' || !img) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth = penWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
    function onMove(ev) {
      ctx.lineTo(
        (ev.clientX - rect.left) / scale,
        (ev.clientY - rect.top) / scale
      );
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

  function handleModeChange(_, val) {
    setMode(val);
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
          </Toolbar>
        </AppBar>
        <Box
          component='canvas'
          ref={canvasRef}
          onMouseDown={startDraw}
          sx={{
            display: 'block',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: img ? `${img.width * scale}px` : 'auto',
            height: img ? `${img.height * scale}px` : 'auto',
            border: '1px solid #ccc',
            m: 'auto',
            mt: 2,
          }}
        />
      </Box>
    </ThemeProvider>
  );
}

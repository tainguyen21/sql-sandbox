'use client';

import { useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { format } from 'sql-formatter';

// Dynamic import to avoid SSR issues with Monaco
const Editor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => <div className="h-64 bg-muted animate-pulse rounded-md" />,
});

interface Props {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  height?: string;
}

export function MonacoSqlEditor({ value, onChange, onExecute, height = '250px' }: Props) {
  const editorRef = useRef<any>(null);
  // Use ref to avoid stale closure in Monaco keybinding
  const onExecuteRef = useRef(onExecute);
  onExecuteRef.current = onExecute;

  const handleMount = useCallback(
    (editor: any, monaco: any) => {
      editorRef.current = editor;

      // Ctrl+Enter to execute
      editor.addAction({
        id: 'execute-query',
        label: 'Execute Query',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => onExecuteRef.current(),
      });

      // Ctrl+Shift+F to format
      editor.addAction({
        id: 'format-sql',
        label: 'Format SQL',
        keybindings: [
          monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
        ],
        run: () => {
          try {
            const formatted = format(editor.getValue(), { language: 'postgresql' });
            editor.setValue(formatted);
          } catch {
            // If format fails, leave as-is
          }
        },
      });
    },
    [],
  );

  return (
    <Editor
      height={height}
      language="sql"
      theme="vs-dark"
      value={value}
      onChange={(v) => onChange(v || '')}
      onMount={handleMount}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        tabSize: 2,
        automaticLayout: true,
        suggest: { showKeywords: true },
      }}
    />
  );
}

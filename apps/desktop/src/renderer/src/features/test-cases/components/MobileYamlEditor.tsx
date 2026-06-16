const PLACEHOLDER = `appId: com.example.app\n---\n- tapOn: "Login"\n- inputText: "user@example.com"\n- assertVisible: "Welcome"`;

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function MobileYamlEditor({ value, onChange }: Props) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-3 pt-2 pb-1 text-[10px] text-muted-foreground/60 shrink-0">
        Maestro YAML — write flows directly. Run with{" "}
        <code className="font-mono bg-muted/40 px-1 rounded">maestro test &lt;file&gt;</code>
      </div>
      <textarea
        className="flex-1 resize-none bg-transparent font-mono text-xs text-foreground p-3 outline-none border-0 focus:ring-0"
        spellCheck={false}
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

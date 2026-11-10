"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, Send } from "lucide-react";
import { extractMentionedMemberIds } from "@/lib/portal-data";
import type { TeamMember } from "@/lib/portal-types";

interface MentionComposerProps {
  team: TeamMember[];
  placeholder?: string;
  submitLabel?: string;
  compact?: boolean;
  onSubmit: (text: string, mentionedMemberIds: string[]) => void;
}

export function MentionComposer({
  team,
  placeholder = "Add a note or type @ to tag a teammate (e.g. @Shashank M.)...",
  submitLabel = "Post & notify",
  compact = false,
  onSubmit,
}: MentionComposerProps) {
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTeam = useMemo(() => team.filter((m) => m.active), [team]);

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return activeTeam.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [activeTeam, mentionQuery]);

  const updateMentionState = (value: string, cursorPos: number) => {
    const upToCursor = value.slice(0, cursorPos);
    const match = upToCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (match) {
      const query = match[1];
      const atIdx = upToCursor.lastIndexOf("@");
      setMentionQuery(query);
      setMentionStartIndex(atIdx);
      setSelectedIdx(0);
    } else {
      setMentionQuery(null);
      setMentionStartIndex(-1);
    }
  };

  const insertMention = (member: TeamMember) => {
    const start = mentionStartIndex;
    const el = textareaRef.current;
    const cursor = el ? el.selectionStart : text.length;
    if (start < 0) {
      const next = `${text}${text && !text.endsWith(" ") ? " " : ""}@${member.name} `;
      setText(next);
    } else {
      const before = text.slice(0, start);
      const after = text.slice(cursor);
      const next = `${before}@${member.name} ${after}`;
      setText(next);
      window.requestAnimationFrame(() => {
        if (textareaRef.current) {
          const newPos = before.length + member.name.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    }
    setMentionQuery(null);
    setMentionStartIndex(-1);
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mentionedIds = extractMentionedMemberIds(trimmed, activeTeam);
    onSubmit(trimmed, mentionedIds);
    setText("");
    setMentionQuery(null);
    setMentionStartIndex(-1);
  };

  const previewTagged = useMemo(
    () => extractMentionedMemberIds(text, activeTeam),
    [text, activeTeam]
  );

  return (
    <div className={`mention-composer ${compact ? "compact" : ""}`}>
      <div className="mention-input-wrap">
        <textarea
          ref={textareaRef}
          value={text}
          rows={compact ? 2 : 3}
          placeholder={placeholder}
          onChange={(e) => {
            const val = e.target.value;
            setText(val);
            updateMentionState(val, e.target.selectionStart ?? val.length);
          }}
          onKeyDown={(e) => {
            if (mentionQuery !== null && suggestions.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIdx((i) => (i + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIdx(
                  (i) => (i - 1 + suggestions.length) % suggestions.length
                );
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(suggestions[selectedIdx] ?? suggestions[0]);
                return;
              }
              if (e.key === "Escape") {
                setMentionQuery(null);
                return;
              }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {mentionQuery !== null && suggestions.length > 0 && (
          <div className="mention-dropdown" role="listbox">
            {suggestions.map((member, idx) => (
              <button
                type="button"
                key={member.id}
                className={`mention-option ${idx === selectedIdx ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
              >
                <span className="mention-mini-avatar">
                  {member.name
                    .split(" ")
                    .map((x) => x[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <b>{member.name}</b>
                  <small>
                    {member.role} · {member.email}
                  </small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mention-toolbar">
        <div className="mention-quick-tags">
          <span className="small muted">Quick tag:</span>
          {activeTeam.map((member) => {
            const isTagged = previewTagged.includes(member.id);
            return (
              <button
                type="button"
                key={member.id}
                className={`tag-pill-btn ${isTagged ? "tagged" : ""}`}
                onClick={() => insertMention(member)}
              >
                <AtSign size={11} />
                {member.name}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="primary"
          disabled={!text.trim()}
          onClick={handleSubmit}
        >
          <Send size={13} /> {submitLabel}
        </button>
      </div>
    </div>
  );
}


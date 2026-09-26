/**
 * Hand-authored types matching supabase/schema.sql.
 * In production, regenerate with:
 *   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts
 */

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export type ConversionStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ConversionKind =
  | 'pdf_to_docx'
  | 'docx_to_pdf'
  | 'txt_md_to_pdf'
  | 'md_to_html'
  | 'xlsx_to_csv'
  | 'csv_to_xlsx'
  | 'xlsx_to_json'
  | 'pdf_page_to_image'
  | 'image_to_pdf'
  | 'heic_to_jpg'
  | 'svg_to_png'
  | 'svg_to_pdf'
  | 'audio_convert'
  | 'audio_video_transcribe'
  | 'video_to_gif'
  | 'video_to_mp3'
  | 'zip_extract'
  | 'zip_compress';

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string;
}

export interface FolderRow {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  created_by: string;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  title: string;
  content: Record<string, unknown>; // ProseMirror/TipTap JSON
  yjs_state: string | null;
  icon: string | null;
  is_pinned: boolean;
  is_daily_note: boolean;
  daily_note_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TagRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
}

export interface DocumentTagRow {
  document_id: string;
  tag_id: string;
}

export interface FileConversionRow {
  id: string;
  workspace_id: string;
  requested_by: string;
  kind: ConversionKind;
  status: ConversionStatus;
  source_path: string;
  result_path: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

/** Minimal Supabase Database type — extend with `Row`/`Insert`/`Update` per table as needed. */
export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: Partial<UserRow>; Update: Partial<UserRow> };
      workspaces: { Row: WorkspaceRow; Insert: Partial<WorkspaceRow>; Update: Partial<WorkspaceRow> };
      workspace_members: {
        Row: WorkspaceMemberRow;
        Insert: Partial<WorkspaceMemberRow>;
        Update: Partial<WorkspaceMemberRow>;
      };
      folders: { Row: FolderRow; Insert: Partial<FolderRow>; Update: Partial<FolderRow> };
      documents: { Row: DocumentRow; Insert: Partial<DocumentRow>; Update: Partial<DocumentRow> };
      tags: { Row: TagRow; Insert: Partial<TagRow>; Update: Partial<TagRow> };
      document_tags: {
        Row: DocumentTagRow;
        Insert: Partial<DocumentTagRow>;
        Update: Partial<DocumentTagRow>;
      };
      file_conversions: {
        Row: FileConversionRow;
        Insert: Partial<FileConversionRow>;
        Update: Partial<FileConversionRow>;
      };
    };
  };
}

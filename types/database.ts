export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Skill {
    id: string
    name: string
    slug: string
    source_url: string
    source_type: 'github'
    created_at: string
    updated_at: string
}

export interface Scan {
    id: string
    skill_id: string
    status: 'queued' | 'running' | 'done' | 'error'
    commit_sha: string | null
    scan_pack_json: Json
    static_json: Json
    deep_json: Json
    risk_level: 'low' | 'medium' | 'high' | null
    verified_badge: 'none' | 'bronze' | 'silver' | 'pinned' | null
    error_text: string | null
    created_at: string
}

export interface Artifact {
    id: string
    scan_id: string
    type: 'policy_json' | 'verification_md' | 'patch_diff'
    storage_path: string
    created_at: string
}

export interface Database {
    public: {
        Tables: {
            skills: {
                Row: Skill
                Insert: Omit<Skill, 'id' | 'created_at' | 'updated_at'>
                Update: Partial<Omit<Skill, 'id' | 'created_at' | 'updated_at'>>
                Relationships: []
            }
            scans: {
                Row: Scan
                Insert: Omit<Scan, 'id' | 'created_at'>
                Update: Partial<Omit<Scan, 'id' | 'created_at'>>
                Relationships: [
                    {
                        foreignKeyName: "scans_skill_id_fkey"
                        columns: ["skill_id"]
                        referencedRelation: "skills"
                        referencedColumns: ["id"]
                    }
                ]
            }
            artifacts: {
                Row: Artifact
                Insert: Omit<Artifact, 'id' | 'created_at'>
                Update: Partial<Omit<Artifact, 'id' | 'created_at'>>
                Relationships: [
                    {
                        foreignKeyName: "artifacts_scan_id_fkey"
                        columns: ["scan_id"]
                        referencedRelation: "scans"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

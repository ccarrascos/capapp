export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      asistencias_modulo: {
        Row: {
          created_at: string
          fecha: string
          hora_inicio: string | null
          hora_termino: string | null
          id: string
          inscripcion_id: string
          modulo_id: string
          presente: boolean
          tiempo_permanencia_min: number | null
        }
        Insert: {
          created_at?: string
          fecha: string
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          inscripcion_id: string
          modulo_id: string
          presente?: boolean
          tiempo_permanencia_min?: number | null
        }
        Update: {
          created_at?: string
          fecha?: string
          hora_inicio?: string | null
          hora_termino?: string | null
          id?: string
          inscripcion_id?: string
          modulo_id?: string
          presente?: boolean
          tiempo_permanencia_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asistencias_modulo_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asistencias_modulo_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["inscripcion_id"]
          },
          {
            foreignKeyName: "asistencias_modulo_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      auditoria_log: {
        Row: {
          accion: string
          created_at: string
          datos_anteriores: Json | null
          datos_nuevos: Json | null
          id: string
          registro_id: string | null
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id?: string | null
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          datos_anteriores?: Json | null
          datos_nuevos?: Json | null
          id?: string
          registro_id?: string | null
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auditoria_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          organizacion_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          organizacion_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          organizacion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_trabajo: {
        Row: {
          activo: boolean
          comuna: string | null
          created_at: string
          direccion: string | null
          id: string
          nombre: string
          organizacion_id: string
          region: string | null
        }
        Insert: {
          activo?: boolean
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre: string
          organizacion_id: string
          region?: string | null
        }
        Update: {
          activo?: boolean
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          nombre?: string
          organizacion_id?: string
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centros_trabajo_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      certificados: {
        Row: {
          archivo_url: string | null
          created_at: string
          curso_id: string
          entidad_emisora_id: string | null
          entidad_emisora_tipo: Database["public"]["Enums"]["entidad_emisora_tipo"]
          fecha_emision: string
          fecha_vigencia_hasta: string
          id: string
          inscripcion_id: string
          numero_certificado: string
          persona_run: string
        }
        Insert: {
          archivo_url?: string | null
          created_at?: string
          curso_id: string
          entidad_emisora_id?: string | null
          entidad_emisora_tipo: Database["public"]["Enums"]["entidad_emisora_tipo"]
          fecha_emision?: string
          fecha_vigencia_hasta: string
          id?: string
          inscripcion_id: string
          numero_certificado: string
          persona_run: string
        }
        Update: {
          archivo_url?: string | null
          created_at?: string
          curso_id?: string
          entidad_emisora_id?: string | null
          entidad_emisora_tipo?: Database["public"]["Enums"]["entidad_emisora_tipo"]
          fecha_emision?: string
          fecha_vigencia_hasta?: string
          id?: string
          inscripcion_id?: string
          numero_certificado?: string
          persona_run?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificados_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: true
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificados_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: true
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["inscripcion_id"]
          },
          {
            foreignKeyName: "certificados_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["persona_run"]
          },
          {
            foreignKeyName: "certificados_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "certificados_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["run"]
          },
        ]
      }
      cursos: {
        Row: {
          created_at: string
          descripcion: string | null
          horas_totales: number
          id: string
          incorpora_enfoque_genero: boolean
          manual_facilitador_path: string | null
          manual_participante_path: string | null
          nombre: string
          oal_id: string | null
          organizacion_id: string | null
          otec_id: string | null
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
          version: string | null
          vigente: boolean
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          horas_totales?: number
          id?: string
          incorpora_enfoque_genero?: boolean
          manual_facilitador_path?: string | null
          manual_participante_path?: string | null
          nombre: string
          oal_id?: string | null
          organizacion_id?: string | null
          otec_id?: string | null
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
          version?: string | null
          vigente?: boolean
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          horas_totales?: number
          id?: string
          incorpora_enfoque_genero?: boolean
          manual_facilitador_path?: string | null
          manual_participante_path?: string | null
          nombre?: string
          oal_id?: string | null
          organizacion_id?: string | null
          otec_id?: string | null
          tipo_proveedor?: Database["public"]["Enums"]["tipo_proveedor"]
          version?: string | null
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cursos_oal_id_fkey"
            columns: ["oal_id"]
            isOneToOne: false
            referencedRelation: "organismos_administradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cursos_otec_id_fkey"
            columns: ["otec_id"]
            isOneToOne: false
            referencedRelation: "entidades_acreditadas"
            referencedColumns: ["id"]
          },
        ]
      }
      ediciones_curso: {
        Row: {
          centro_trabajo_id: string | null
          created_at: string
          created_by: string | null
          curso_id: string
          estado: Database["public"]["Enums"]["estado_edicion"]
          facilitador_id: string | null
          fecha_inicio: string
          fecha_limite: string
          fecha_termino: string | null
          id: string
          oal_id: string | null
          organizacion_id: string
          otec_id: string | null
          programa_trabajo_preventivo_id: string | null
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
        }
        Insert: {
          centro_trabajo_id?: string | null
          created_at?: string
          created_by?: string | null
          curso_id: string
          estado?: Database["public"]["Enums"]["estado_edicion"]
          facilitador_id?: string | null
          fecha_inicio: string
          fecha_limite: string
          fecha_termino?: string | null
          id?: string
          oal_id?: string | null
          organizacion_id: string
          otec_id?: string | null
          programa_trabajo_preventivo_id?: string | null
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
        }
        Update: {
          centro_trabajo_id?: string | null
          created_at?: string
          created_by?: string | null
          curso_id?: string
          estado?: Database["public"]["Enums"]["estado_edicion"]
          facilitador_id?: string | null
          fecha_inicio?: string
          fecha_limite?: string
          fecha_termino?: string | null
          id?: string
          oal_id?: string | null
          organizacion_id?: string
          otec_id?: string | null
          programa_trabajo_preventivo_id?: string | null
          tipo_proveedor?: Database["public"]["Enums"]["tipo_proveedor"]
        }
        Relationships: [
          {
            foreignKeyName: "ediciones_curso_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_facilitador_id_fkey"
            columns: ["facilitador_id"]
            isOneToOne: false
            referencedRelation: "facilitadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_oal_id_fkey"
            columns: ["oal_id"]
            isOneToOne: false
            referencedRelation: "organismos_administradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_otec_id_fkey"
            columns: ["otec_id"]
            isOneToOne: false
            referencedRelation: "entidades_acreditadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ediciones_curso_programa_trabajo_preventivo_id_fkey"
            columns: ["programa_trabajo_preventivo_id"]
            isOneToOne: false
            referencedRelation: "programas_trabajo_preventivo"
            referencedColumns: ["id"]
          },
        ]
      }
      entidades_acreditadas: {
        Row: {
          activo: boolean
          codigo_sence: string | null
          contacto_email: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string
          id: string
          nombre: string
          rut: string | null
        }
        Insert: {
          activo?: boolean
          codigo_sence?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          id?: string
          nombre: string
          rut?: string | null
        }
        Update: {
          activo?: boolean
          codigo_sence?: string | null
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          id?: string
          nombre?: string
          rut?: string | null
        }
        Relationships: []
      }
      evaluaciones_resultado: {
        Row: {
          aprobado: boolean
          created_at: string
          fecha: string
          id: string
          inscripcion_id: string
          intento_numero: number
          modulo_id: string | null
          puntaje: number | null
          respuestas: Json | null
        }
        Insert: {
          aprobado?: boolean
          created_at?: string
          fecha?: string
          id?: string
          inscripcion_id: string
          intento_numero?: number
          modulo_id?: string | null
          puntaje?: number | null
          respuestas?: Json | null
        }
        Update: {
          aprobado?: boolean
          created_at?: string
          fecha?: string
          id?: string
          inscripcion_id?: string
          intento_numero?: number
          modulo_id?: string | null
          puntaje?: number | null
          respuestas?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluaciones_resultado_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "inscripciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluaciones_resultado_inscripcion_id_fkey"
            columns: ["inscripcion_id"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["inscripcion_id"]
          },
          {
            foreignKeyName: "evaluaciones_resultado_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      facilitadores: {
        Row: {
          activo: boolean
          apellidos: string
          created_at: string
          dv: string
          es_experto_prevencion: boolean
          id: string
          nombres: string
          oal_id: string | null
          organizacion_id: string | null
          otec_id: string | null
          run: string
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
          titulo_profesional: string | null
          usuario_id: string | null
        }
        Insert: {
          activo?: boolean
          apellidos: string
          created_at?: string
          dv: string
          es_experto_prevencion?: boolean
          id?: string
          nombres: string
          oal_id?: string | null
          organizacion_id?: string | null
          otec_id?: string | null
          run: string
          tipo_proveedor: Database["public"]["Enums"]["tipo_proveedor"]
          titulo_profesional?: string | null
          usuario_id?: string | null
        }
        Update: {
          activo?: boolean
          apellidos?: string
          created_at?: string
          dv?: string
          es_experto_prevencion?: boolean
          id?: string
          nombres?: string
          oal_id?: string | null
          organizacion_id?: string | null
          otec_id?: string | null
          run?: string
          tipo_proveedor?: Database["public"]["Enums"]["tipo_proveedor"]
          titulo_profesional?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "facilitadores_oal_id_fkey"
            columns: ["oal_id"]
            isOneToOne: false
            referencedRelation: "organismos_administradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitadores_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitadores_otec_id_fkey"
            columns: ["otec_id"]
            isOneToOne: false
            referencedRelation: "entidades_acreditadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilitadores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      historial_centro_trabajo: {
        Row: {
          cambiado_en: string
          cambiado_por: string | null
          centro_anterior_id: string | null
          centro_nuevo_id: string | null
          id: string
          organizacion_id: string
          persona_run: string
        }
        Insert: {
          cambiado_en?: string
          cambiado_por?: string | null
          centro_anterior_id?: string | null
          centro_nuevo_id?: string | null
          id?: string
          organizacion_id: string
          persona_run: string
        }
        Update: {
          cambiado_en?: string
          cambiado_por?: string | null
          centro_anterior_id?: string | null
          centro_nuevo_id?: string | null
          id?: string
          organizacion_id?: string
          persona_run?: string
        }
        Relationships: [
          {
            foreignKeyName: "historial_centro_trabajo_cambiado_por_fkey"
            columns: ["cambiado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_centro_anterior_id_fkey"
            columns: ["centro_anterior_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_centro_nuevo_id_fkey"
            columns: ["centro_nuevo_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["persona_run"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "historial_centro_trabajo_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["run"]
          },
        ]
      }
      inscripciones: {
        Row: {
          created_at: string
          edicion_id: string
          estado: Database["public"]["Enums"]["estado_inscripcion"]
          fecha_aprobacion: string | null
          fecha_inscripcion: string
          id: string
          manual_entregado: boolean
          manual_entregado_fecha: string | null
          persona_run: string
          updated_at: string
          vigencia_hasta: string | null
        }
        Insert: {
          created_at?: string
          edicion_id: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          fecha_aprobacion?: string | null
          fecha_inscripcion?: string
          id?: string
          manual_entregado?: boolean
          manual_entregado_fecha?: string | null
          persona_run: string
          updated_at?: string
          vigencia_hasta?: string | null
        }
        Update: {
          created_at?: string
          edicion_id?: string
          estado?: Database["public"]["Enums"]["estado_inscripcion"]
          fecha_aprobacion?: string | null
          fecha_inscripcion?: string
          id?: string
          manual_entregado?: boolean
          manual_entregado_fecha?: string | null
          persona_run?: string
          updated_at?: string
          vigencia_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inscripciones_edicion_id_fkey"
            columns: ["edicion_id"]
            isOneToOne: false
            referencedRelation: "ediciones_curso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inscripciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["persona_run"]
          },
          {
            foreignKeyName: "inscripciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "inscripciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["run"]
          },
        ]
      }
      modulos: {
        Row: {
          created_at: string
          curso_id: string
          duracion_horas: number
          id: string
          material_path: string | null
          modalidad: Database["public"]["Enums"]["modalidad_ejecucion"]
          nombre: string
          objetivos_aprendizaje: string | null
          orden: number
          recursos_didacticos: string | null
          tema: Database["public"]["Enums"]["tema_modulo"]
        }
        Insert: {
          created_at?: string
          curso_id: string
          duracion_horas: number
          id?: string
          material_path?: string | null
          modalidad: Database["public"]["Enums"]["modalidad_ejecucion"]
          nombre: string
          objetivos_aprendizaje?: string | null
          orden: number
          recursos_didacticos?: string | null
          tema: Database["public"]["Enums"]["tema_modulo"]
        }
        Update: {
          created_at?: string
          curso_id?: string
          duracion_horas?: number
          id?: string
          material_path?: string | null
          modalidad?: Database["public"]["Enums"]["modalidad_ejecucion"]
          nombre?: string
          objetivos_aprendizaje?: string | null
          orden?: number
          recursos_didacticos?: string | null
          tema?: Database["public"]["Enums"]["tema_modulo"]
        }
        Relationships: [
          {
            foreignKeyName: "modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificaciones: {
        Row: {
          created_at: string
          id: string
          leido: boolean
          mensaje: string
          persona_run: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          leido?: boolean
          mensaje: string
          persona_run?: string | null
          tipo: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          leido?: boolean
          mensaje?: string
          persona_run?: string | null
          tipo?: Database["public"]["Enums"]["tipo_notificacion"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificaciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["persona_run"]
          },
          {
            foreignKeyName: "notificaciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "notificaciones_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "notificaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      organismos_administradores: {
        Row: {
          activo: boolean
          contacto_email: string | null
          contacto_nombre: string | null
          contacto_telefono: string | null
          created_at: string
          id: string
          nombre: string
          rut: string | null
          tipo: string | null
        }
        Insert: {
          activo?: boolean
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          id?: string
          nombre: string
          rut?: string | null
          tipo?: string | null
        }
        Update: {
          activo?: boolean
          contacto_email?: string | null
          contacto_nombre?: string | null
          contacto_telefono?: string | null
          created_at?: string
          id?: string
          nombre?: string
          rut?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      organizaciones: {
        Row: {
          activo: boolean
          comuna: string | null
          created_at: string
          direccion: string | null
          email_contacto: string | null
          id: string
          logo_url: string | null
          nombre_fantasia: string | null
          oal_id: string | null
          razon_social: string
          region: string | null
          rut: string
          sector_economico: string | null
          tamano_empresa: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          email_contacto?: string | null
          id?: string
          logo_url?: string | null
          nombre_fantasia?: string | null
          oal_id?: string | null
          razon_social: string
          region?: string | null
          rut: string
          sector_economico?: string | null
          tamano_empresa?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          comuna?: string | null
          created_at?: string
          direccion?: string | null
          email_contacto?: string | null
          id?: string
          logo_url?: string | null
          nombre_fantasia?: string | null
          oal_id?: string | null
          razon_social?: string
          region?: string | null
          rut?: string
          sector_economico?: string | null
          tamano_empresa?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizaciones_oal_id_fkey"
            columns: ["oal_id"]
            isOneToOne: false
            referencedRelation: "organismos_administradores"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          apellido_materno: string | null
          apellido_paterno: string
          created_at: string
          dv: string
          email: string | null
          fecha_nacimiento: string | null
          nombres: string
          run: string
          telefono: string | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          apellido_materno?: string | null
          apellido_paterno: string
          created_at?: string
          dv: string
          email?: string | null
          fecha_nacimiento?: string | null
          nombres: string
          run: string
          telefono?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          apellido_materno?: string | null
          apellido_paterno?: string
          created_at?: string
          dv?: string
          email?: string | null
          fecha_nacimiento?: string | null
          nombres?: string
          run?: string
          telefono?: string | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      programas_trabajo_preventivo: {
        Row: {
          anio: number
          created_at: string
          documento_url: string | null
          fecha_aprobacion: string | null
          id: string
          organizacion_id: string
          periodicidad_capacitacion_meses: number
          responsable_usuario_id: string | null
        }
        Insert: {
          anio: number
          created_at?: string
          documento_url?: string | null
          fecha_aprobacion?: string | null
          id?: string
          organizacion_id: string
          periodicidad_capacitacion_meses?: number
          responsable_usuario_id?: string | null
        }
        Update: {
          anio?: number
          created_at?: string
          documento_url?: string | null
          fecha_aprobacion?: string | null
          id?: string
          organizacion_id?: string
          periodicidad_capacitacion_meses?: number
          responsable_usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programas_trabajo_preventivo_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programas_trabajo_preventivo_responsable_usuario_id_fkey"
            columns: ["responsable_usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          descripcion: string | null
          id: string
          nivel_jerarquico: number
          nombre: Database["public"]["Enums"]["rol_nombre"]
        }
        Insert: {
          descripcion?: string | null
          id?: string
          nivel_jerarquico: number
          nombre: Database["public"]["Enums"]["rol_nombre"]
        }
        Update: {
          descripcion?: string | null
          id?: string
          nivel_jerarquico?: number
          nombre?: Database["public"]["Enums"]["rol_nombre"]
        }
        Relationships: []
      }
      usuario_roles: {
        Row: {
          centro_trabajo_id: string | null
          created_at: string
          id: string
          organizacion_id: string | null
          rol_id: string
          usuario_id: string
        }
        Insert: {
          centro_trabajo_id?: string | null
          created_at?: string
          id?: string
          organizacion_id?: string | null
          rol_id: string
          usuario_id: string
        }
        Update: {
          centro_trabajo_id?: string | null
          created_at?: string
          id?: string
          organizacion_id?: string | null
          rol_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_roles_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_roles_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_roles_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_roles_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          apellidos: string
          avatar_url: string | null
          created_at: string
          dv: string | null
          email: string
          id: string
          nombres: string
          run: string | null
          telefono: string | null
          ultimo_acceso: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          apellidos: string
          avatar_url?: string | null
          created_at?: string
          dv?: string | null
          email: string
          id: string
          nombres: string
          run?: string | null
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          apellidos?: string
          avatar_url?: string | null
          created_at?: string
          dv?: string | null
          email?: string
          id?: string
          nombres?: string
          run?: string | null
          telefono?: string | null
          ultimo_acceso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      vinculos_laborales: {
        Row: {
          activo: boolean
          cargo_id: string | null
          centro_trabajo_id: string | null
          created_at: string
          fecha_ingreso: string | null
          fecha_termino: string | null
          id: string
          modalidad_contractual: Database["public"]["Enums"]["modalidad_contractual"]
          organizacion_id: string
          persona_run: string
          qr_token: string
          unidad: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          cargo_id?: string | null
          centro_trabajo_id?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_termino?: string | null
          id?: string
          modalidad_contractual?: Database["public"]["Enums"]["modalidad_contractual"]
          organizacion_id: string
          persona_run: string
          qr_token?: string
          unidad?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          cargo_id?: string | null
          centro_trabajo_id?: string | null
          created_at?: string
          fecha_ingreso?: string | null
          fecha_termino?: string | null
          id?: string
          modalidad_contractual?: Database["public"]["Enums"]["modalidad_contractual"]
          organizacion_id?: string
          persona_run?: string
          qr_token?: string
          unidad?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_laborales_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_laborales_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_laborales_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_laborales_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["persona_run"]
          },
          {
            foreignKeyName: "vinculos_laborales_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "matriz_vigencia_capacitacion"
            referencedColumns: ["run"]
          },
          {
            foreignKeyName: "vinculos_laborales_persona_run_fkey"
            columns: ["persona_run"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["run"]
          },
        ]
      }
    }
    Views: {
      matriz_vigencia_capacitacion: {
        Row: {
          apellido_materno: string | null
          apellido_paterno: string | null
          cargo: string | null
          centro_trabajo_id: string | null
          curso_id: string | null
          dv: string | null
          estado_vigencia: string | null
          fecha_aprobacion: string | null
          inscripcion_id: string | null
          modalidad_contractual:
            | Database["public"]["Enums"]["modalidad_contractual"]
            | null
          nombres: string | null
          organizacion_id: string | null
          persona_run: string | null
          run: string | null
          trabajador_activo: boolean | null
          unidad: string | null
          vigencia_hasta: string | null
          vinculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ediciones_curso_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "cursos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_laborales_centro_trabajo_id_fkey"
            columns: ["centro_trabajo_id"]
            isOneToOne: false
            referencedRelation: "centros_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vinculos_laborales_organizacion_id_fkey"
            columns: ["organizacion_id"]
            isOneToOne: false
            referencedRelation: "organizaciones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      app_es_super_admin: { Args: never; Returns: boolean }
      app_organizaciones_usuario: { Args: never; Returns: string[] }
      app_persona_run_actual: { Args: never; Returns: string }
      app_puede_gestionar_trabajadores: { Args: never; Returns: boolean }
      app_tiene_rol_en_org: {
        Args: {
          p_org: string
          p_rol: Database["public"]["Enums"]["rol_nombre"]
        }
        Returns: boolean
      }
    }
    Enums: {
      entidad_emisora_tipo: "empleador" | "oal" | "otec"
      estado_edicion: "planificada" | "en_curso" | "finalizada" | "cancelada"
      estado_inscripcion:
        | "inscrito"
        | "en_progreso"
        | "aprobado"
        | "reprobado"
        | "desertor"
      modalidad_contractual:
        | "indefinido"
        | "plazo_fijo"
        | "obra_o_faena"
        | "aprendiz"
        | "honorarios"
        | "otro"
      modalidad_ejecucion:
        | "telematica_asincronica"
        | "telematica_sincronica"
        | "presencial"
        | "mixta"
      rol_nombre:
        | "super_admin"
        | "admin_organizacion"
        | "prevencionista"
        | "facilitador"
        | "supervisor_centro"
        | "trabajador"
        | "auditor"
      tema_modulo:
        | "introduccion"
        | "marco_general_sst"
        | "identificacion_peligros_evaluacion_riesgos"
        | "riesgos_laborales_efectos_salud"
        | "medidas_preventivas_proteccion"
        | "gestion_emergencias_desastres"
        | "senalizacion_prevencion_incendios"
      tipo_notificacion:
        | "vencimiento_proximo"
        | "vencido"
        | "nueva_inscripcion"
        | "curso_finalizado"
      tipo_proveedor: "interno" | "oal" | "otec"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      entidad_emisora_tipo: ["empleador", "oal", "otec"],
      estado_edicion: ["planificada", "en_curso", "finalizada", "cancelada"],
      estado_inscripcion: [
        "inscrito",
        "en_progreso",
        "aprobado",
        "reprobado",
        "desertor",
      ],
      modalidad_contractual: [
        "indefinido",
        "plazo_fijo",
        "obra_o_faena",
        "aprendiz",
        "honorarios",
        "otro",
      ],
      modalidad_ejecucion: [
        "telematica_asincronica",
        "telematica_sincronica",
        "presencial",
        "mixta",
      ],
      rol_nombre: [
        "super_admin",
        "admin_organizacion",
        "prevencionista",
        "facilitador",
        "supervisor_centro",
        "trabajador",
        "auditor",
      ],
      tema_modulo: [
        "introduccion",
        "marco_general_sst",
        "identificacion_peligros_evaluacion_riesgos",
        "riesgos_laborales_efectos_salud",
        "medidas_preventivas_proteccion",
        "gestion_emergencias_desastres",
        "senalizacion_prevencion_incendios",
      ],
      tipo_notificacion: [
        "vencimiento_proximo",
        "vencido",
        "nueva_inscripcion",
        "curso_finalizado",
      ],
      tipo_proveedor: ["interno", "oal", "otec"],
    },
  },
} as const

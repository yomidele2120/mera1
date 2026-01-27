import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Persona {
  id: string;
  user_id: string;
  persona_type: "public" | "friends" | "business" | "anonymous";
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_default: boolean;
  privacy_level: string;
  created_at: string;
  updated_at: string;
}

export const usePersonas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPersonas = async () => {
    if (!user) {
      setPersonas([]);
      setActivePersona(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("personas")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (error) throw error;

      const typedPersonas = (data || []) as Persona[];
      setPersonas(typedPersonas);

      // Set default active persona
      const defaultPersona = typedPersonas.find((p) => p.is_default) || typedPersonas[0];
      if (defaultPersona && !activePersona) {
        setActivePersona(defaultPersona);
      }
    } catch (error) {
      console.error("Error fetching personas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [user]);

  const selectPersona = (persona: Persona) => {
    setActivePersona(persona);
  };

  const createPersona = async (data: Partial<Persona>) => {
    if (!user) return;

    try {
      const { data: newPersona, error } = await supabase
        .from("personas")
        .insert({
          user_id: user.id,
          persona_type: data.persona_type || "friends",
          username: data.username?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "",
          display_name: data.display_name || null,
          bio: data.bio || null,
          is_default: false,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Username taken",
            description: "That username is already in use",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Persona created",
        description: `@${newPersona.username} is ready to use`,
      });

      await fetchPersonas();
      setActivePersona(newPersona as Persona);
    } catch (error: any) {
      console.error("Error creating persona:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create persona",
        variant: "destructive",
      });
    }
  };

  return {
    personas,
    activePersona,
    loading,
    selectPersona,
    createPersona,
    refreshPersonas: fetchPersonas,
  };
};

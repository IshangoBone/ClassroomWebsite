import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { supabaseConfig } from "./config.local.js";

const { supabaseUrl, supabasePublishableKey } = supabaseConfig;

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

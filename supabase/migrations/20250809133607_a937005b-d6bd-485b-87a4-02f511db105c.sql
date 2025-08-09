-- Add new fields to clients table
ALTER TABLE public.clients 
ADD COLUMN email TEXT,
ADD COLUMN gender TEXT CHECK (gender IN ('masculino', 'feminino', 'outro')),
ADD COLUMN birth_date DATE;

-- Create settings table for user preferences
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  establishment_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inactive_days_threshold INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (establishment_id)
);

-- Enable RLS for settings
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for settings
CREATE POLICY "Establishments can manage their settings" 
ON public.settings 
FOR ALL 
USING (establishment_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

-- Create trigger for settings timestamp updates
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings for existing establishments
INSERT INTO public.settings (establishment_id)
SELECT id FROM public.profiles
ON CONFLICT (establishment_id) DO NOTHING;
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Palette, Calculator, Mail, MessageSquare } from 'lucide-react';
import BrandingSection from './BrandingSection';
import BusinessRulesSection from './BusinessRulesSection';
import EmailTemplatesSection from './EmailTemplatesSection';
import BotTextsSection from './BotTextsSection';

const SystemConfigTab: React.FC = () => {
  const [tab, setTab] = useState('branding');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">System Configuration</h2>
        <p className="text-sm text-muted-foreground">Manage branding, fees, email templates, and bot texts — all from one place.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="branding"><Palette className="w-4 h-4 mr-1" /> Branding</TabsTrigger>
          <TabsTrigger value="business"><Calculator className="w-4 h-4 mr-1" /> Business Rules</TabsTrigger>
          <TabsTrigger value="email"><Mail className="w-4 h-4 mr-1" /> Email Templates</TabsTrigger>
          <TabsTrigger value="bot"><MessageSquare className="w-4 h-4 mr-1" /> Bot Texts</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4"><BrandingSection /></TabsContent>
        <TabsContent value="business" className="mt-4"><BusinessRulesSection /></TabsContent>
        <TabsContent value="email" className="mt-4"><EmailTemplatesSection /></TabsContent>
        <TabsContent value="bot" className="mt-4"><BotTextsSection /></TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemConfigTab;

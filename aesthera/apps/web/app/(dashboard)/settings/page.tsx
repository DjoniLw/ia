'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BusinessHoursTab } from './_components/business-hours-tab'
import { ClinicTab } from './_components/clinic-tab'
import { UsersTab } from './_components/users-tab'

export default function SettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-semibold mb-6">Configurações</h2>

      <Tabs defaultValue="clinic">
        <TabsList>
          <TabsTrigger value="clinic">Clínica</TabsTrigger>
          <TabsTrigger value="hours">Horários</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        <TabsContent value="clinic">
          <ClinicTab />
        </TabsContent>

        <TabsContent value="hours">
          <BusinessHoursTab />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

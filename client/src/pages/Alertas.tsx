import { trpc } from '@/lib/trpc';
import { formatData } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCircle, EyeOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const criticidadeConfig = {
  critica: { label: 'Crítica', variant: 'danger' as const, color: 'border-l-red-500' },
  alta: { label: 'Alta', variant: 'danger' as const, color: 'border-l-orange-500' },
  media: { label: 'Média', variant: 'warning' as const, color: 'border-l-yellow-500' },
  baixa: { label: 'Baixa', variant: 'info' as const, color: 'border-l-blue-500' },
};

export function Alertas() {
  const { data: alertas = [], refetch } = trpc.alertas.list.useQuery({ status: 'ativo' });
  const { data: count } = trpc.alertas.getCount.useQuery();

  const marcarLido = trpc.alertas.marcarLido.useMutation({
    onSuccess: () => { refetch(); },
  });
  const resolver = trpc.alertas.resolver.useMutation({
    onSuccess: () => { toast.success('Alerta resolvido'); refetch(); },
  });
  const ignorar = trpc.alertas.ignorar.useMutation({
    onSuccess: () => { refetch(); },
  });
  const runAlertas = trpc.alertas.run.useMutation({
    onSuccess: (d) => { toast.success(`${d.novosAlertas} novos alertas gerados`); refetch(); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {count?.criticos ? <span className="text-red-600 font-medium">{count.criticos} críticos · </span> : null}
            {count?.altos ? <span className="text-orange-600 font-medium">{count.altos} altos · </span> : null}
            {count?.total} alertas ativos
          </p>
        </div>
        <Button variant="outline" onClick={() => runAlertas.mutate()} disabled={runAlertas.isPending}>
          <RefreshCw className={`w-4 h-4 mr-2 ${runAlertas.isPending ? 'animate-spin' : ''}`} />
          Verificar Alertas
        </Button>
      </div>

      {alertas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum alerta ativo</p>
            <p className="text-sm mt-1">O sistema está operando normalmente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Group by criticidade */}
          {(['critica', 'alta', 'media', 'baixa'] as const).map(crit => {
            const grupo = alertas.filter(a => a.criticidade === crit);
            if (grupo.length === 0) return null;
            return (
              <div key={crit}>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {criticidadeConfig[crit].label} ({grupo.length})
                </h2>
                <div className="space-y-2">
                  {grupo.map(alerta => (
                    <Card key={alerta.id} className={`border-l-4 ${criticidadeConfig[alerta.criticidade as keyof typeof criticidadeConfig]?.color || 'border-l-gray-400'}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={criticidadeConfig[alerta.criticidade as keyof typeof criticidadeConfig]?.variant || 'secondary'}>
                                {criticidadeConfig[alerta.criticidade as keyof typeof criticidadeConfig]?.label}
                              </Badge>
                              <span className="font-semibold text-gray-800">{alerta.titulo}</span>
                            </div>
                            <p className="text-sm text-gray-600">{alerta.mensagem}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatData(alerta.criadoEm?.toString())}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => resolver.mutate(alerta.id)} title="Resolver">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => ignorar.mutate(alerta.id)} title="Ignorar">
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

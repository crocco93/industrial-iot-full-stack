import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ExternalLink, Bot, Zap, Send, RefreshCw, Settings, Activity } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { api } from '../../services/api';

interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  nodes: number;
  connections: number;
}

interface LLMModel {
  name: string;
  size: string;
  digest: string;
  modified_at: string;
}

interface OllamaStats {
  models: LLMModel[];
  version: string;
  gpu_info?: string;
}

export function IntegrationManager() {
  const [n8nWorkflows, setN8nWorkflows] = useState<N8NWorkflow[]>([]);
  const [ollamaModels, setOllamaModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [n8nConnected, setN8nConnected] = useState(false);
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmResponse, setLlmResponse] = useState('');
  const [processingLlm, setProcessingLlm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkIntegrations();
    loadN8NWorkflows();
    loadOllamaModels();
  }, []);

  const checkIntegrations = async () => {
    try {
      // Check N8N connection
      const n8nResponse = await fetch('http://localhost:5678/api/v1/workflows', {
        headers: {
          'Authorization': 'Basic ' + btoa('admin:industrial_n8n_2024')
        }
      });
      setN8nConnected(n8nResponse.ok);
    } catch (error) {
      setN8nConnected(false);
    }

    try {
      // Check Ollama connection
      const ollamaResponse = await fetch('http://localhost:11434/api/tags');
      setOllamaConnected(ollamaResponse.ok);
    } catch (error) {
      setOllamaConnected(false);
    }
  };

  const loadN8NWorkflows = async () => {
    if (!n8nConnected) return;
    
    try {
      const response = await fetch('http://localhost:5678/api/v1/workflows', {
        headers: {
          'Authorization': 'Basic ' + btoa('admin:industrial_n8n_2024')
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setN8nWorkflows(data.data || []);
      }
    } catch (error) {
      console.error('Error loading N8N workflows:', error);
    }
  };

  const loadOllamaModels = async () => {
    if (!ollamaConnected) return;
    
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (response.ok) {
        const data = await response.json();
        setOllamaModels(data.models || []);
      }
    } catch (error) {
      console.error('Error loading Ollama models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLlmQuery = async () => {
    if (!llmPrompt.trim() || !ollamaConnected) return;
    
    setProcessingLlm(true);
    try {
      const response = await api.post('/api/integrations/llm/query', {
        prompt: `Jako ekspert od systemów przemysłowych IoT, przeanalizuj następujące pytanie w kontekście monitoringu i zarządzania urządzeniami przemysłowymi:\n\n${llmPrompt}`
      });
      
      setLlmResponse(response.data.response || 'Brak odpowiedzi');
      toast({
        title: "Sukces",
        description: "Otrzymano odpowiedź od LLM",
      });
    } catch (error) {
      console.error('Error querying LLM:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się wysłać zapytania do LLM",
        variant: "destructive",
      });
    } finally {
      setProcessingLlm(false);
    }
  };

  const toggleN8NWorkflow = async (workflow: N8NWorkflow) => {
    try {
      const action = workflow.active ? 'deactivate' : 'activate';
      const response = await fetch(`http://localhost:5678/api/v1/workflows/${workflow.id}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('admin:industrial_n8n_2024'),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await loadN8NWorkflows();
        toast({
          title: "Sukces",
          description: `Workflow ${workflow.name} został ${workflow.active ? 'dezaktywowany' : 'aktywowany'}`,
        });
      }
    } catch (error) {
      console.error('Error toggling workflow:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się zmienić statusu workflow",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (size: string) => {
    const sizeNum = parseFloat(size);
    if (sizeNum > 1024 * 1024 * 1024) {
      return `${(sizeNum / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (sizeNum > 1024 * 1024) {
      return `${(sizeNum / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${sizeNum.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Integracje systemowe</h1>
          <p className="text-gray-600">Zarządzaj integracjami z N8N, Ollama LLM i innymi systemami</p>
        </div>
        <Button onClick={checkIntegrations}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sprawdź połączenia
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">N8N Workflow Engine</CardTitle>
            <Zap className={`h-4 w-4 ${n8nConnected ? 'text-green-600' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={n8nConnected ? 'default' : 'secondary'}>
                {n8nConnected ? 'Połączony' : 'Rozłączony'}
              </Badge>
              {n8nConnected && (
                <span className="text-sm text-gray-600">
                  {n8nWorkflows.length} workflows
                </span>
              )}
            </div>
            {n8nConnected && (
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => window.open('http://localhost:5678', '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Otwórz N8N
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ollama LLM</CardTitle>
            <Bot className={`h-4 w-4 ${ollamaConnected ? 'text-blue-600' : 'text-gray-400'}`} />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Badge variant={ollamaConnected ? 'default' : 'secondary'}>
                {ollamaConnected ? 'Aktywny' : 'Nieaktywny'}
              </Badge>
              {ollamaConnected && (
                <span className="text-sm text-gray-600">
                  {ollamaModels.length} modeli
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="n8n" className="space-y-4">
        <TabsList>
          <TabsTrigger value="n8n">N8N Workflows</TabsTrigger>
          <TabsTrigger value="llm">LLM Assistant</TabsTrigger>
          <TabsTrigger value="models">Modele LLM</TabsTrigger>
        </TabsList>

        <TabsContent value="n8n">
          <Card>
            <CardHeader>
              <CardTitle>N8N Workflows</CardTitle>
              <CardDescription>
                Zarządzaj workflow automatyzacji dla systemów przemysłowych
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!n8nConnected ? (
                <div className="text-center py-8">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">N8N nie jest dostępny</h3>
                  <p className="text-gray-600 mb-4">
                    Uruchom N8N używając: docker-compose --profile full up
                  </p>
                  <Button onClick={checkIntegrations}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sprawdź ponownie
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium">Aktywne workflows</h3>
                      <p className="text-sm text-gray-600">Zarządzaj automatyzacją procesów</p>
                    </div>
                    <Button onClick={() => window.open('http://localhost:5678', '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Otwórz N8N Editor
                    </Button>
                  </div>
                  
                  {n8nWorkflows.length === 0 ? (
                    <div className="text-center py-4 text-gray-600">
                      Brak skonfigurowanych workflows
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {n8nWorkflows.map((workflow) => (
                        <div key={workflow.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Activity className={`h-5 w-5 ${workflow.active ? 'text-green-600' : 'text-gray-400'}`} />
                            <div>
                              <h4 className="font-medium">{workflow.name}</h4>
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <span>{workflow.nodes} węzłów</span>
                                <span>•</span>
                                <span>{workflow.connections} połączeń</span>
                                {workflow.tags && workflow.tags.length > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{workflow.tags.join(', ')}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={workflow.active ? 'default' : 'secondary'}>
                              {workflow.active ? 'Aktywny' : 'Nieaktywny'}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => toggleN8NWorkflow(workflow)}
                            >
                              {workflow.active ? 'Zatrzymaj' : 'Uruchom'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>LLM Assistant</CardTitle>
              <CardDescription>
                Zadawaj pytania dotyczące systemów przemysłowych i analizy danych
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ollamaConnected ? (
                <div className="text-center py-8">
                  <Bot className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Ollama LLM nie jest dostępny</h3>
                  <p className="text-gray-600 mb-4">
                    Uruchom Ollama używając: docker-compose --profile full up
                  </p>
                  <Button onClick={checkIntegrations}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sprawdź ponownie
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="llm-prompt">Zapytanie do AI</Label>
                    <Textarea
                      id="llm-prompt"
                      value={llmPrompt}
                      onChange={(e) => setLlmPrompt(e.target.value)}
                      placeholder="Np. 'Przeanalizuj wydajność protokołu Modbus w ostatnich 24 godzinach'"
                      rows={3}
                      className="mt-1"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleLlmQuery}
                    disabled={!llmPrompt.trim() || processingLlm}
                    className="w-full"
                  >
                    {processingLlm ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {processingLlm ? 'Przetwarzanie...' : 'Wyślij zapytanie'}
                  </Button>
                  
                  {llmResponse && (
                    <div className="mt-4">
                      <Label>Odpowiedź AI:</Label>
                      <div className="mt-2 p-4 bg-gray-50 rounded-lg border">
                        <pre className="whitespace-pre-wrap text-sm">{llmResponse}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Modele LLM</CardTitle>
              <CardDescription>
                Dostępne modele językowe do analizy danych przemysłowych
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ollamaConnected ? (
                <div className="text-center py-8 text-gray-600">
                  Ollama nie jest połączony
                </div>
              ) : loading ? (
                <div className="text-center py-8 text-gray-600">
                  Ładowanie modeli...
                </div>
              ) : (
                <div className="space-y-4">
                  {ollamaModels.length === 0 ? (
                    <div className="text-center py-4 text-gray-600">
                      Brak zainstalowanych modeli LLM
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {ollamaModels.map((model, index) => (
                        <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Bot className="h-5 w-5 text-blue-600" />
                            <div>
                              <h4 className="font-medium">{model.name}</h4>
                              <p className="text-sm text-gray-600">
                                Rozmiar: {formatFileSize(model.size)} • 
                                Zmodyfikowany: {new Date(model.modified_at).toLocaleString('pl-PL')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge>Zainstalowany</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
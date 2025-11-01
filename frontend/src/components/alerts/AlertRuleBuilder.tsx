import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Bell,
  Clock,
  Code,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
  Settings,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle,
  XCircle,
  Zap,
  Timer
} from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface AlertCondition {
  id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between' | 'is_null' | 'is_not_null';
  value: any;
  value2?: any; // For 'between' operator
}

interface AlertAction {
  id: string;
  type: 'email' | 'webhook' | 'toast' | 'log' | 'script';
  config: Record<string, any>;
  enabled: boolean;
}

interface AlertRule {
  id?: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source_type: 'device' | 'protocol' | 'connection' | 'system' | 'data_point';
  source_filter: Record<string, any>;
  conditions: AlertCondition[];
  actions: AlertAction[];
  enabled: boolean;
  trigger_frequency: number; // seconds
  cooldown_period: number; // seconds
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals', symbol: '=' },
  { value: 'not_equals', label: 'Not Equals', symbol: '≠' },
  { value: 'greater_than', label: 'Greater Than', symbol: '>' },
  { value: 'less_than', label: 'Less Than', symbol: '<' },
  { value: 'contains', label: 'Contains', symbol: '⊃' },
  { value: 'between', label: 'Between', symbol: '↔' },
  { value: 'is_null', label: 'Is Empty', symbol: '∅' },
  { value: 'is_not_null', label: 'Is Not Empty', symbol: '≠∅' }
];

const SEVERITY_CONFIG = {
  info: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  warning: { color: 'bg-yellow-100 text-yellow-800', icon: AlertTriangle },
  error: { color: 'bg-red-100 text-red-800', icon: XCircle },
  critical: { color: 'bg-red-600 text-white', icon: AlertTriangle }
};

const ACTION_TYPES = [
  { 
    type: 'email', 
    label: 'Email Notification', 
    icon: Mail, 
    description: 'Send email to specified addresses',
    config_fields: ['recipients', 'subject_template', 'body_template']
  },
  { 
    type: 'webhook', 
    label: 'Webhook', 
    icon: Zap, 
    description: 'HTTP POST to webhook URL',
    config_fields: ['url', 'method', 'headers', 'payload_template']
  },
  { 
    type: 'toast', 
    label: 'UI Notification', 
    icon: Bell, 
    description: 'Show notification in UI',
    config_fields: ['duration', 'position']
  },
  { 
    type: 'log', 
    label: 'System Log', 
    icon: Activity, 
    description: 'Write to system log',
    config_fields: ['log_level', 'log_format']
  },
  { 
    type: 'script', 
    label: 'Custom Script', 
    icon: Code, 
    description: 'Execute custom script',
    config_fields: ['script_path', 'arguments']
  }
];

interface AlertRuleBuilderProps {
  ruleId?: string;
  onSave?: (rule: AlertRule) => void;
  onCancel?: () => void;
}

export function AlertRuleBuilder({ ruleId, onSave, onCancel }: AlertRuleBuilderProps) {
  const [rule, setRule] = useState<AlertRule>({
    name: 'New Alert Rule',
    description: '',
    severity: 'warning',
    source_type: 'device',
    source_filter: {},
    conditions: [],
    actions: [],
    enabled: true,
    trigger_frequency: 60,
    cooldown_period: 300,
    tags: []
  });
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [devices, setDevices] = useState([]);
  const [protocols, setProtocols] = useState([]);
  const { toast } = useToast();
  
  useEffect(() => {
    loadReferenceData();
    if (ruleId) {
      loadRule();
    }
  }, [ruleId]);
  
  const loadReferenceData = async () => {
    try {
      const [devicesResponse, protocolsResponse] = await Promise.all([
        api.get('/api/devices').catch(() => ({ data: [] })),
        api.get('/api/protocols').catch(() => ({ data: [] }))
      ]);
      
      setDevices(devicesResponse.data || []);
      setProtocols(protocolsResponse.data || []);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  };
  
  const loadRule = async () => {
    if (!ruleId) return;
    
    try {
      setLoading(true);
      const response = await api.get(`/api/alerts/rules/${ruleId}`);
      setRule(response.data);
    } catch (error) {
      console.error('Failed to load alert rule:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load alert rule",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const saveRule = async () => {
    try {
      setSaving(true);
      
      if (!rule.name || rule.conditions.length === 0) {
        toast({
          title: "Validation Error",
          description: "Rule name and at least one condition are required",
          variant: "destructive"
        });
        return;
      }
      
      const ruleData = {
        ...rule,
        updated_at: new Date().toISOString()
      };
      
      let response;
      if (ruleId) {
        response = await api.put(`/api/alerts/rules/${ruleId}`, ruleData);
      } else {
        response = await api.post('/api/alerts/rules', ruleData);
      }
      
      toast({
        title: "Rule Saved",
        description: `${rule.name} has been saved successfully`
      });
      
      onSave?.(response.data);
      
    } catch (error: any) {
      console.error('Failed to save alert rule:', error);
      toast({
        title: "Save Failed",
        description: error.response?.data?.detail || "Failed to save alert rule",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  
  const addCondition = () => {
    const newCondition: AlertCondition = {
      id: `condition_${Date.now()}`,
      field: 'status',
      operator: 'equals',
      value: ''
    };
    
    setRule(prev => ({
      ...prev,
      conditions: [...prev.conditions, newCondition]
    }));
  };
  
  const updateCondition = (conditionId: string, updates: Partial<AlertCondition>) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.map(c => 
        c.id === conditionId ? { ...c, ...updates } : c
      )
    }));
  };
  
  const removeCondition = (conditionId: string) => {
    setRule(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.id !== conditionId)
    }));
  };
  
  const addAction = () => {
    const newAction: AlertAction = {
      id: `action_${Date.now()}`,
      type: 'toast',
      config: {
        message: 'Alert triggered: {{rule_name}}',
        duration: 5000
      },
      enabled: true
    };
    
    setRule(prev => ({
      ...prev,
      actions: [...prev.actions, newAction]
    }));
  };
  
  const updateAction = (actionId: string, updates: Partial<AlertAction>) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.map(a => 
        a.id === actionId ? { ...a, ...updates } : a
      )
    }));
  };
  
  const removeAction = (actionId: string) => {
    setRule(prev => ({
      ...prev,
      actions: prev.actions.filter(a => a.id !== actionId)
    }));
  };
  
  const getSeverityIcon = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
    const IconComponent = config.icon;
    return <IconComponent className="h-4 w-4" />;
  };
  
  const getSeverityBadge = (severity: string) => {
    const config = SEVERITY_CONFIG[severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
    return (
      <Badge className={`${config.color} text-xs`}>
        {severity.toUpperCase()}
      </Badge>
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Rule Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-2 flex-1 mr-4">
          <Input
            value={rule.name}
            onChange={(e) => setRule(prev => ({ ...prev, name: e.target.value }))}
            className="text-xl font-bold bg-transparent border-none p-0 h-auto focus-visible:ring-0"
            placeholder="Alert Rule Name"
          />
          
          <Textarea
            value={rule.description}
            onChange={(e) => setRule(prev => ({ ...prev, description: e.target.value }))}
            className="resize-none bg-transparent border-none p-0 text-gray-600 focus-visible:ring-0"
            placeholder="Describe when this alert should trigger..."
            rows={2}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Switch
              checked={rule.enabled}
              onCheckedChange={(checked) => setRule(prev => ({ ...prev, enabled: checked }))}
            />
            <Label>Enabled</Label>
          </div>
          
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={saveRule} disabled={saving}>
            {saving ? 'Saving...' : ruleId ? 'Update Rule' : 'Create Rule'}
          </Button>
        </div>
      </div>
      
      {/* Rule Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Basic Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Severity Level</Label>
              <Select value={rule.severity} onValueChange={(value: any) => setRule(prev => ({ ...prev, severity: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEVERITY_CONFIG).map(([severity, config]) => {
                    const IconComponent = config.icon;
                    return (
                      <SelectItem key={severity} value={severity}>
                        <div className="flex items-center space-x-2">
                          <IconComponent className="h-4 w-4" />
                          <span className="capitalize">{severity}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Data Source</Label>
              <Select value={rule.source_type} onValueChange={(value: any) => setRule(prev => ({ ...prev, source_type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="device">Device Status</SelectItem>
                  <SelectItem value="protocol">Protocol Connection</SelectItem>
                  <SelectItem value="connection">Communication Health</SelectItem>
                  <SelectItem value="data_point">Sensor Data</SelectItem>
                  <SelectItem value="system">System Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check Frequency (seconds)</Label>
                <Select 
                  value={rule.trigger_frequency.toString()} 
                  onValueChange={(value) => setRule(prev => ({ ...prev, trigger_frequency: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="900">15 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Cooldown Period (seconds)</Label>
                <Select 
                  value={rule.cooldown_period.toString()} 
                  onValueChange={(value) => setRule(prev => ({ ...prev, cooldown_period: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="900">15 minutes</SelectItem>
                    <SelectItem value="3600">1 hour</SelectItem>
                    <SelectItem value="86400">24 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rule Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                {getSeverityIcon(rule.severity)}
                <span className="font-medium">{rule.name || 'Unnamed Rule'}</span>
                {getSeverityBadge(rule.severity)}
                {!rule.enabled && <Badge variant="secondary">Disabled</Badge>}
              </div>
              
              <div className="text-sm text-gray-600">
                {rule.description || 'No description provided'}
              </div>
              
              <Separator />
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Target className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Source:</span>
                  <Badge variant="outline">{rule.source_type}</Badge>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Timer className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Check every:</span>
                  <span className="font-medium">{rule.trigger_frequency}s</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Cooldown:</span>
                  <span className="font-medium">{Math.floor(rule.cooldown_period / 60)}m</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Conditions:</span>
                  <span className="font-medium">{rule.conditions.length}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Bell className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-700">Actions:</span>
                  <span className="font-medium">{rule.actions.filter(a => a.enabled).length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Alert Conditions ({rule.conditions.length})
            </div>
            <Button size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-1" />
              Add Condition
            </Button>
          </CardTitle>
          <CardDescription>
            Define the conditions that must be met to trigger this alert
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rule.conditions.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No conditions defined</p>
              <p className="text-sm text-gray-500 mb-4">Add conditions to specify when this alert should trigger</p>
              <Button onClick={addCondition}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Condition
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {rule.conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center space-x-3 p-3 border rounded">
                  {index > 0 && (
                    <Badge variant="outline" className="text-xs font-mono">AND</Badge>
                  )}
                  
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div>
                      <Select 
                        value={condition.field} 
                        onValueChange={(value) => updateCondition(condition.id, { field: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status">Status</SelectItem>
                          <SelectItem value="online">Online</SelectItem>
                          <SelectItem value="response_time">Response Time</SelectItem>
                          <SelectItem value="error_count">Error Count</SelectItem>
                          <SelectItem value="value">Data Value</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Select 
                        value={condition.operator} 
                        onValueChange={(value: any) => updateCondition(condition.id, { operator: value })}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono text-xs">{op.symbol}</span>
                                <span>{op.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Input
                        value={condition.value}
                        onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                        placeholder="Value"
                        className="h-8"
                      />
                    </div>
                    
                    {condition.operator === 'between' && (
                      <div>
                        <Input
                          value={condition.value2 || ''}
                          onChange={(e) => updateCondition(condition.id, { value2: e.target.value })}
                          placeholder="Max value"
                          className="h-8"
                        />
                      </div>
                    )}
                  </div>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCondition(condition.id)}
                    className="text-red-600 hover:text-red-800 p-1 h-6 w-6"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="h-5 w-5 mr-2" />
              Alert Actions ({rule.actions.filter(a => a.enabled).length}/{rule.actions.length})
            </div>
            <Button size="sm" onClick={addAction}>
              <Plus className="h-4 w-4 mr-1" />
              Add Action
            </Button>
          </CardTitle>
          <CardDescription>
            Define what happens when the alert conditions are met
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rule.actions.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No actions defined</p>
              <p className="text-sm text-gray-500 mb-4">Add actions to specify what happens when alerts trigger</p>
              <Button onClick={addAction}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Action
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rule.actions.map((action) => {
                const actionType = ACTION_TYPES.find(at => at.type === action.type);
                const IconComponent = actionType?.icon || Bell;
                
                return (
                  <div key={action.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={action.enabled}
                          onCheckedChange={(checked) => updateAction(action.id, { enabled: checked })}
                        />
                        <IconComponent className="h-4 w-4" />
                        <span className="font-medium">{actionType?.label}</span>
                        {!action.enabled && <Badge variant="secondary">Disabled</Badge>}
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeAction(action.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      {actionType?.description}
                    </div>
                    
                    {/* Action-specific configuration */}
                    {action.type === 'email' && (
                      <div className="space-y-2">
                        <div>
                          <Label>Recipients (comma-separated)</Label>
                          <Input
                            value={action.config.recipients || ''}
                            onChange={(e) => updateAction(action.id, {
                              config: { ...action.config, recipients: e.target.value }
                            })}
                            placeholder="admin@company.com, ops@company.com"
                          />
                        </div>
                        <div>
                          <Label>Subject Template</Label>
                          <Input
                            value={action.config.subject_template || ''}
                            onChange={(e) => updateAction(action.id, {
                              config: { ...action.config, subject_template: e.target.value }
                            })}
                            placeholder="[{{severity}}] {{rule_name}} - {{location}}"
                          />
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'webhook' && (
                      <div className="space-y-2">
                        <div>
                          <Label>Webhook URL</Label>
                          <Input
                            value={action.config.url || ''}
                            onChange={(e) => updateAction(action.id, {
                              config: { ...action.config, url: e.target.value }
                            })}
                            placeholder="https://hooks.slack.com/services/..."
                          />
                        </div>
                        <div>
                          <Label>HTTP Method</Label>
                          <Select 
                            value={action.config.method || 'POST'} 
                            onValueChange={(value) => updateAction(action.id, {
                              config: { ...action.config, method: value }
                            })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="POST">POST</SelectItem>
                              <SelectItem value="PUT">PUT</SelectItem>
                              <SelectItem value="PATCH">PATCH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    
                    {action.type === 'toast' && (
                      <div className="space-y-2">
                        <div>
                          <Label>Message Template</Label>
                          <Input
                            value={action.config.message || ''}
                            onChange={(e) => updateAction(action.id, {
                              config: { ...action.config, message: e.target.value }
                            })}
                            placeholder="Alert: {{rule_name}} triggered on {{device_name}}"
                          />
                        </div>
                        <div>
                          <Label>Display Duration (ms)</Label>
                          <Input
                            type="number"
                            value={action.config.duration || 5000}
                            onChange={(e) => updateAction(action.id, {
                              config: { ...action.config, duration: parseInt(e.target.value) }
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Advanced Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advanced Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Tags (comma-separated)</Label>
            <Input
              value={rule.tags.join(', ')}
              onChange={(e) => setRule(prev => ({ 
                ...prev, 
                tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
              }))}
              placeholder="production, critical, plc, modbus"
            />
            <p className="text-xs text-gray-500 mt-1">
              Tags help organize and filter alert rules
            </p>
          </div>
          
          <div className="p-4 bg-yellow-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Template Variables:</strong> Use variables like <code>{{device_name}}</code>, <code>{{value}}</code>, 
                <code>{{timestamp}}</code>, <code>{{rule_name}}</code> in your action templates.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
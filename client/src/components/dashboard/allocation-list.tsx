import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Asset, Allocation } from "@shared/schema";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Save, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AllocationListProps {
  allocations: Allocation[];
  assets: Asset[];
  isLoading?: boolean;
  onAllocationUpdated: () => void;
}

export default function AllocationList({
  allocations,
  assets,
  isLoading = false,
  onAllocationUpdated,
}: AllocationListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState<Record<number, boolean>>({});
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [deleting, setDeleting] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  
  // Get asset name from ID
  const getAssetName = (assetId: number) => {
    const asset = assets.find((a) => a.id === assetId);
    return asset ? `${asset.name} (${asset.symbol})` : "Unknown Asset";
  };

  // Enable edit mode for an allocation
  const handleEdit = (allocation: Allocation) => {
    setEditMode((prev) => ({ ...prev, [allocation.id]: true }));
    setEditValues((prev) => ({ 
      ...prev, 
      [allocation.id]: allocation.targetPercentage.toString() 
    }));
  };

  // Save edited allocation
  const handleSave = async (allocation: Allocation) => {
    const newValue = editValues[allocation.id];
    const numValue = parseFloat(newValue);
    
    if (isNaN(numValue) || numValue <= 0 || numValue > 100) {
      toast({
        title: "Invalid value",
        description: "Percentage must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }
    
    // Calculate what the total would be after this change
    const currentValue = parseFloat(allocation.targetPercentage.toString());
    const otherAllocations = allocations.filter((a) => a.id !== allocation.id);
    const otherTotal = otherAllocations.reduce(
      (sum, a) => sum + parseFloat(a.targetPercentage.toString()),
      0
    );
    
    // Check if the new total would exceed 100%
    if (otherTotal + numValue > 100) {
      toast({
        title: "Allocation Error",
        description: `Total allocation would exceed 100% (${(otherTotal + numValue).toFixed(2)}%)`,
        variant: "destructive",
      });
      return;
    }
    
    setSaving((prev) => ({ ...prev, [allocation.id]: true }));
    
    try {
      await apiRequest("PUT", `/api/allocations/${allocation.id}`, {
        targetPercentage: numValue,
      });
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/vaults/${allocation.vaultId}/allocations`] 
      });
      
      setEditMode((prev) => ({ ...prev, [allocation.id]: false }));
      onAllocationUpdated();
      
      toast({
        title: "Allocation updated",
        description: "Asset allocation has been updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating allocation:", error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update allocation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving((prev) => ({ ...prev, [allocation.id]: false }));
    }
  };

  // Delete allocation
  const handleDelete = async (allocation: Allocation) => {
    setDeleting((prev) => ({ ...prev, [allocation.id]: true }));
    
    try {
      await apiRequest("DELETE", `/api/allocations/${allocation.id}`, {});
      
      queryClient.invalidateQueries({ 
        queryKey: [`/api/vaults/${allocation.vaultId}/allocations`] 
      });
      
      onAllocationUpdated();
      
      toast({
        title: "Allocation removed",
        description: "Asset allocation has been removed successfully",
      });
    } catch (error: any) {
      console.error("Error deleting allocation:", error);
      toast({
        title: "Deletion failed",
        description: error.message || "Failed to remove allocation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting((prev) => ({ ...prev, [allocation.id]: false }));
    }
  };
  
  // Handle input change
  const handleInputChange = (allocationId: number, value: string) => {
    setEditValues((prev) => ({ ...prev, [allocationId]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocations</CardTitle>
          <CardDescription>Current portfolio allocation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg">Asset Allocations</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Current portfolio allocation</CardDescription>
      </CardHeader>
      <CardContent>
        {allocations.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {allocations.map((allocation) => (
              <div 
                key={allocation.id} 
                className="p-2 sm:p-4 border rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                    {getAssetName(allocation.assetId)}
                  </p>
                  
                  {!editMode[allocation.id] && (
                    <Badge variant="secondary" className="text-xs">
                      {parseFloat(allocation.targetPercentage.toString()).toFixed(2)}%
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {editMode[allocation.id] ? (
                    <div className="relative w-full sm:w-40">
                      <Input 
                        type="number"
                        value={editValues[allocation.id]}
                        onChange={(e) => handleInputChange(allocation.id, e.target.value)}
                        className="pr-8 w-full h-8 text-sm"
                        min="0.01"
                        max="100"
                        step="0.01"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        %
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="flex items-center space-x-2 ml-auto">
                    {editMode[allocation.id] ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSave(allocation)}
                        disabled={saving[allocation.id]}
                        className="h-8 text-xs w-[70px]"
                      >
                        {saving[allocation.id] ? (
                          "Saving..."
                        ) : (
                          <>
                            <Save className="h-3 w-3 mr-1" />
                            Save
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleEdit(allocation)}
                        className="h-8 text-xs w-[70px]"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDelete(allocation)}
                      disabled={deleting[allocation.id]}
                      className="h-8 text-xs w-[70px]"
                    >
                      {deleting[allocation.id] ? (
                        "..."
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground text-sm">No assets allocated yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Add assets using the form below
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import React from 'react';
import { PlayerState, GameItem, EquipmentSlot } from '../types';
import { ALL_STATUS_EFFECT_DEFINITIONS } from '../constants'; // For displaying cure names

interface InventoryModalProps {
  player: PlayerState;
  onClose: () => void;
  onUseItem: (item: GameItem) => void;
  onToggleEquipment: (item: GameItem) => void;
  isCombatActive: boolean;
}

const ItemCard: React.FC<{ 
    item: GameItem; 
    isEquipped?: boolean;
    onAction: () => void; 
    actionLabel?: string; 
    isCombatActive: boolean;
}> = ({ item, isEquipped, onAction, isCombatActive }) => {
  let borderColor = 'var(--pixel-border)';
  if (isEquipped) borderColor = 'var(--pixel-highlight)';
  else if (item.type === 'weapon' || item.type === 'armor' || item.type === 'accessory') borderColor = 'var(--pixel-accent)';

  let currentActionLabel: string;
  let isDisabled = false;
  let buttonClass = "pixel-button"; 

  if (item.type === 'consumable') {
    currentActionLabel = isCombatActive ? "전투 사용" : "사용";
    if (item.quantity === 0) isDisabled = true;
    buttonClass += " !bg-[var(--pixel-success)] !text-[var(--pixel-bg-dark)]";
  } else if (item.equipSlot) {
    currentActionLabel = isEquipped ? "해제" : "장착";
    if (isCombatActive) isDisabled = true;
    buttonClass += isEquipped ? " !bg-[var(--pixel-error)]" : " !bg-[var(--pixel-highlight)] !text-[var(--pixel-bg-dark)]";
  } else { 
    currentActionLabel = "정보"; 
    isDisabled = true;
  }
  
  if (item.type === 'keyItem') { 
    currentActionLabel = "정보";
    isDisabled = true;
  }

  const getCureEffectDescription = () => {
    if (item.effects?.curesEffect && item.effects.curesEffect.length > 0) {
      const effectNames = item.effects.curesEffect
        .map(id => ALL_STATUS_EFFECT_DEFINITIONS[id]?.name)
        .filter(name => name)
        .join(', ');
      return effectNames ? `${effectNames} 치료` : '';
    }
    return '';
  };
  const cureDesc = getCureEffectDescription();


  return (
    <div className={`bg-[var(--pixel-bg-dark)] p-2 border-2 flex flex-col text-sm`} style={{borderColor: borderColor}}> 
      <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1 truncate leading-tight"> 
        {item.icon && <span className="mr-1.5">{item.icon}</span>}
        {item.name} {item.quantity > 1 && item.type !== 'weapon' && item.type !== 'armor' && item.type !== 'accessory' ? `x${item.quantity}`: ''}
      </h4>
      <p className="text-xs text-[var(--pixel-text-dim)] mb-1.5 flex-grow min-h-[24px] leading-relaxed">{item.description}</p> 
      {item.effects && (
        <div className="text-xs text-[var(--pixel-success)] mb-1 truncate"> 
          효과:
          {item.effects.hp && ` HP+${item.effects.hp}`}
          {item.effects.mp && ` MP+${item.effects.mp}`}
          {item.effects.attack && ` ATK+${item.effects.attack}`}
          {item.effects.defense && ` DEF+${item.effects.defense}`}
          {item.effects.speed && ` SPD+${item.effects.speed}`}
          {item.effects.luck && ` LCK+${item.effects.luck}`}
          {item.effects.critChance && ` CRT+${item.effects.critChance}%`}
          {cureDesc && <span className="ml-1 text-[var(--pixel-accent)]"> ({cureDesc})</span>}
        </div>
      )}
      {item.sellPrice !== undefined && <p className="text-xs text-[var(--pixel-border)] mb-1.5">판매가: {item.sellPrice}G</p>} 
      
      <button
        onClick={onAction}
        disabled={isDisabled}
        className={`${buttonClass} mt-auto w-full text-xs !py-1.5 !px-2`} 
      >
        {currentActionLabel}
      </button>
    </div>
  );
};

export const InventoryModal: React.FC<InventoryModalProps> = ({ player, onClose, onUseItem, onToggleEquipment, isCombatActive }) => {
  const equipmentSlots: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];

  return (
    <div className="modal-overlay">
      <div className="modal-content w-full max-w-2xl"> 
        <div className="flex justify-between items-center mb-4"> 
          <h2 className="pixel-header text-xl !mb-0 !pb-0 !border-none text-[var(--pixel-highlight)]">가방 (소지금: {player.gold}G)</h2>
          <button onClick={onClose} className="text-[var(--pixel-text-dim)] text-3xl leading-none">&times;</button> 
        </div>

        <section className="mb-4"> 
          <h3 className="font-pixel-header text-base font-semibold text-[var(--pixel-highlight)] mb-1.5 border-b-2 border-[var(--pixel-border)] pb-1">장착 중</h3> 
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2"> 
            {equipmentSlots.map(slot => {
              const equippedItem = player.equipment[slot];
              if (equippedItem) {
                return (
                  <ItemCard 
                    key={equippedItem.id} 
                    item={equippedItem} 
                    isEquipped 
                    onAction={() => onToggleEquipment(equippedItem)}
                    isCombatActive={isCombatActive}
                  />
                );
              }
              return (
                <div key={slot} className="bg-[var(--pixel-bg-dark)] p-2.5 border-2 border-[var(--pixel-border)] text-center text-[var(--pixel-text-dim)] italic text-sm"> 
                  ({slot === 'weapon' ? '무기' : slot === 'armor' ? '갑옷' : '장신구'}) 없음
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="font-pixel-header text-base font-semibold text-[var(--pixel-highlight)] mb-1.5 border-b-2 border-[var(--pixel-border)] pb-1">소지품</h3> 
          {player.inventory.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1.5"> 
              {player.inventory.map(item => (
                <ItemCard 
                  key={item.id} 
                  item={item}
                  onAction={() => item.equipSlot ? onToggleEquipment(item) : onUseItem(item)}
                  isCombatActive={isCombatActive}
                />
              ))}
            </div>
          ) : (
            <p className="text-[var(--pixel-text-dim)] italic text-center py-3 text-sm">가방이 비었습니다.</p> 
          )}
        </section>

        <button 
          onClick={onClose} 
          className="pixel-button w-full mt-5 text-sm" 
        >
          닫기
        </button>
      </div>
    </div>
  );
};
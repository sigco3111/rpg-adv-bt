import React, { useState } from 'react';
import { PlayerState, GameItem } from '../types';
import { DEFAULT_BUY_PRICE_MULTIPLIER } from '../constants';

interface ShopModalProps {
  player: PlayerState;
  shopItems: GameItem[];
  isOpen: boolean;
  onClose: () => void;
  onBuyItem: (itemId: string, quantity: number) => void;
  onSellItem: (itemId: string, quantity: number) => void;
  shopError: string | null;
}

interface ShopItemCardProps {
  item: GameItem;
  actionType: 'buy' | 'sell';
  playerGold?: number;
  onAction: (itemId: string, quantity: number) => void;
  currentQuantityInInventory?: number;
}

const ShopItemCard: React.FC<ShopItemCardProps> = ({ item, actionType, playerGold, onAction, currentQuantityInInventory }) => {
  const [quantity, setQuantity] = useState(1);

  const buyPrice = item.sellPrice ? item.sellPrice * DEFAULT_BUY_PRICE_MULTIPLIER : undefined;
  const effectivePrice = actionType === 'buy' ? buyPrice : item.sellPrice;

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (actionType === 'sell' && currentQuantityInInventory !== undefined && val > currentQuantityInInventory) {
      val = currentQuantityInInventory;
    }
    setQuantity(val);
  };

  const handleActionClick = () => {
    onAction(item.id, quantity);
    setQuantity(1);
  };

  const canAfford = actionType === 'buy' && playerGold !== undefined && effectivePrice !== undefined ? playerGold >= effectivePrice * quantity : true;
  const hasStockToSell = actionType === 'sell' && currentQuantityInInventory !== undefined ? currentQuantityInInventory >= quantity : true;
  const isActionDisabled = 
    effectivePrice === undefined || 
    effectivePrice <= 0 ||
    (actionType === 'buy' && !canAfford) || 
    (actionType === 'sell' && (!hasStockToSell || quantity === 0));
  
  const buttonBgColor = actionType === 'buy' ? '!bg-[var(--pixel-success)]' : '!bg-[var(--pixel-accent)]';

  return (
    <div className="bg-[var(--pixel-bg-dark)] p-2 border-2 border-[var(--pixel-border)] flex flex-col h-full text-sm"> {/* Base text-sm (VT323), increased padding */}
      <h4 className="font-pixel-header text-sm font-semibold text-[var(--pixel-highlight)] mb-1 truncate leading-tight"> {/* Press Start 2P for item name */}
        {item.icon && <span className="mr-1.5">{item.icon}</span>}
        {item.name}
        {actionType === 'sell' && currentQuantityInInventory !== undefined && <span className="text-xs text-[var(--pixel-text-dim)] ml-1.5">(보유:{currentQuantityInInventory})</span>}
      </h4>
      <p className="text-xs text-[var(--pixel-text-dim)] mb-1.5 flex-grow min-h-[28px] leading-relaxed">{item.description}</p> {/* VT323 for description, increased size and leading */}
      {item.effects && (
        <div className="text-xs text-[var(--pixel-success)] mb-1 truncate"> {/* VT323 for effects */}
          효과:
          {item.effects.hp && ` HP+${item.effects.hp}`}
          {item.effects.mp && ` MP+${item.effects.mp}`}
          {item.effects.attack && ` ATK+${item.effects.attack}`}
          {item.effects.defense && ` DEF+${item.effects.defense}`}
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--pixel-accent)] mb-1.5"> {/* VT323 for price, increased size */}
        {actionType === 'buy' ? '구매가' : '판매가'}: {effectivePrice !== undefined && effectivePrice > 0 ? `${effectivePrice}G` : '거래 불가'}
      </p>
      <div className="flex items-center space-x-1.5 mt-auto"> {/* Increased spacing */}
        <input
          type="number"
          value={quantity}
          onChange={handleQuantityChange}
          min="1"
          max={actionType === 'sell' ? currentQuantityInInventory : 99}
          className="pixel-input w-14 text-xs !p-1" /* VT323 for input, increased padding */
          aria-label={`${item.name} ${actionType === 'buy' ? '구매' : '판매'} 수량`}
          disabled={effectivePrice === undefined || effectivePrice <= 0}
        />
        <button
          onClick={handleActionClick}
          disabled={isActionDisabled}
          className={`pixel-button flex-grow text-xs !py-1.5 !px-2 ${isActionDisabled ? '' : `${buttonBgColor} !text-[var(--pixel-bg-dark)]`}`} /* Button text text-xs (Press Start 2P) */
          aria-label={`${item.name} ${quantity}개 ${actionType === 'buy' ? '구매하기' : '판매하기'}`}
        >
          {actionType === 'buy' ? '구매' : '판매'}
        </button>
      </div>
    </div>
  );
};

export const ShopModal: React.FC<ShopModalProps> = ({ player, shopItems, isOpen, onClose, onBuyItem, onSellItem, shopError }) => {
  if (!isOpen) return null;

  const sellableInventory = player.inventory.filter(item => item.sellPrice !== undefined && item.sellPrice > 0);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-modal-title">
      <div className="modal-content w-full max-w-4xl flex flex-col" style={{maxHeight: '95vh'}}> {/* Wider modal */}
        <div className="flex justify-between items-center mb-2.5 pb-1.5 border-b-2 border-[var(--pixel-border)]"> {/* Increased margins */}
          <h2 id="shop-modal-title" className="pixel-header text-xl !mb-0 !pb-0 !border-none text-[var(--pixel-highlight)]">상점</h2>
          <div className="text-base text-[var(--pixel-accent)]" aria-live="polite">소지금: {player.gold}G</div> {/* Increased font size */}
          <button onClick={onClose} className="text-[var(--pixel-text-dim)] text-3xl leading-none" aria-label="상점 닫기">&times;</button> {/* Larger close button, hover removed */}
        </div>

        {shopError && <p className="text-[var(--pixel-error)] text-sm mb-2.5 text-center bg-[var(--pixel-bg-dark)] p-1.5 border border-[var(--pixel-error)]" role="alert">{shopError}</p>} {/* Increased font size & padding */}

        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-2.5 overflow-hidden"> {/* Increased gap */}
          <section className="flex flex-col overflow-hidden pixel-panel-inset p-2"> {/* Increased padding */}
            <h3 className="font-pixel-header text-base font-semibold text-[var(--pixel-highlight)] mb-2 text-center border-b border-[var(--pixel-border)] pb-1">구매하기</h3> {/* Press Start 2P */}
            {shopItems.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 overflow-y-auto pr-1 flex-grow"> {/* Increased gap */}
                {shopItems.map(item => (
                  <ShopItemCard 
                    key={`buy-${item.id}`} 
                    item={item} 
                    actionType="buy" 
                    playerGold={player.gold}
                    onAction={onBuyItem} 
                  />
                ))}
              </div>
            ) : (
              <p className="text-[var(--pixel-text-dim)] italic text-center py-3 flex-grow flex items-center justify-center text-sm">판매 아이템 없음.</p>
            )}
          </section>

          <section className="flex flex-col overflow-hidden pixel-panel-inset p-2"> {/* Increased padding */}
            <h3 className="font-pixel-header text-base font-semibold text-[var(--pixel-highlight)] mb-2 text-center border-b border-[var(--pixel-border)] pb-1">판매하기</h3> {/* Press Start 2P */}
            {sellableInventory.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 overflow-y-auto pr-1 flex-grow"> {/* Increased gap */}
                {sellableInventory.map(item => (
                  <ShopItemCard 
                    key={`sell-${item.id}`} 
                    item={item} 
                    actionType="sell" 
                    onAction={onSellItem}
                    currentQuantityInInventory={item.quantity}
                  />
                ))}
              </div>
            ) : (
              <p className="text-[var(--pixel-text-dim)] italic text-center py-3 flex-grow flex items-center justify-center text-sm">판매 가능 아이템 없음.</p>
            )}
          </section>
        </div>
        
        <button 
          onClick={onClose} 
          className="pixel-button w-full mt-4 text-sm" /* Button text (Press Start 2P), larger */
        >
          상점 나가기
        </button>
      </div>
    </div>
  );
};
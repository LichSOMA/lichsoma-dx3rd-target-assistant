/**
 * DX3rd Target Assistant Module
 * 아이템 호출 시 타겟 설정을 위한 크로스헤어를 제공하는 모듈
 */

// 모듈 설정
const MODULE_ID = "lichsoma-dx3rd-target-assistant";

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
    console.log("DX3RD-TARGET-ASSISTANT | 모듈이 준비되었습니다.");
  });

/**
 * 모듈 설정 등록
 */
function registerSettings() {
  // 크로스헤어 이미지 설정 (파일픽커)
  game.settings.register(MODULE_ID, "crosshairImage", {
    name: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairImage"),
    hint: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairImageHint"),
    scope: "world",
    config: true,
    type: String,
    filePicker: "image",
    default: "modules/lichsoma-dx3rd-target-assistant/assets/default_crosshair.png"
  });
  
  // 크로스헤어 크기 설정
  game.settings.register(MODULE_ID, "crosshairSize", {
    name: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairSize"),
    hint: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairSizeHint"),
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0.5,
      max: 5,
      step: 0.1
    },
    default: 1.0
  });
  
  // 크로스헤어 투명도 설정
  game.settings.register(MODULE_ID, "crosshairAlpha", {
    name: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairAlpha"),
    hint: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingCrosshairAlphaHint"),
    scope: "world",
    config: true,
    type: Number,
    range: {
      min: 0,
      max: 1,
      step: 0.1
    },
    default: 1.0
  });
  
  // 전투 중에만 활성화 설정
  game.settings.register(MODULE_ID, "onlyInCombat", {
    name: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingOnlyInCombat"),
    hint: game.i18n.localize("DX3RD-TARGET-ASSISTANT.SettingOnlyInCombatHint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/**
 * 전투 중인지 확인
 */
function isInCombat() {
  return game.combat && game.combat.started;
}

/**
 * 전투 중에만 활성화 설정 확인
 */
function shouldRequireCombat() {
  return game.settings.get(MODULE_ID, "onlyInCombat") ?? false;
}

/**
 * 크로스헤어 이미지 경로 가져오기
 */
function getCrosshairImage() {
  return game.settings.get(MODULE_ID, "crosshairImage") || "icons/svg/target.svg";
}

/**
 * 크로스헤어 크기 배율 가져오기
 */
function getCrosshairSize() {
  return game.settings.get(MODULE_ID, "crosshairSize") || 2.0;
}

/**
 * 크로스헤어 투명도 가져오기
 */
function getCrosshairAlpha() {
  return game.settings.get(MODULE_ID, "crosshairAlpha") ?? 1.0;
}

/**
 * 토큰이 hide되었는지 확인
 */
function isTokenHidden(token) {
  if (!token || !token.document) return false;
  
  // Foundry VTT에서 hide된 토큰 확인
  if (token.document.hidden === true) return true;
  if (token.visible === false) return true;
  
  return false;
}

/**
 * 아이템이 공격 굴림을 가지고 있고, 액터가 destruction 타입의 berserk 컨디션을 가지고 있는지 확인
 */
function shouldExcludeSelfForDestructionBerserk(item, actor) {
  if (!item || !actor) return false;
  
  // 아이템의 attackRoll 확인
  const attackRoll = item.system?.attackRoll || item.data?.data?.attackRoll || null;
  if (!attackRoll || attackRoll === "-" || attackRoll === "") {
    return false;
  }
  
  // 액터의 berserk 컨디션 확인
  const conditions = actor.system?.conditions || actor.data?.data?.conditions || {};
  const berserk = conditions.berserk;
  
  if (!berserk) {
    return false;
  }
  
  // berserk.type이 destruction인지 확인
  const berserkType = berserk.type || berserk.Type || null;
  if (berserkType !== "destruction") {
    return false;
  }
  
  return true;
}

/**
 * 토큰이 stealth 컨디션을 가지고 있는지 확인
 */
function hasStealthCondition(token) {
  if (!token || !token.document) return false;
  
  // Foundry VTT 표준 방법 시도
  if (token.document.hasStatusEffect && typeof token.document.hasStatusEffect === "function") {
    if (token.document.hasStatusEffect("stealth")) return true;
  }
  
  // 액터의 컨디션 확인
  if (token.actor) {
    if (token.actor.hasCondition && typeof token.actor.hasCondition === "function") {
      if (token.actor.hasCondition("stealth")) return true;
    }
    
    // effects에서 stealth 찾기
    if (token.actor.effects) {
      const stealthEffect = token.actor.effects.find(effect => {
        const name = effect.name?.toLowerCase() || effect.label?.toLowerCase() || "";
        return name.includes("stealth") || name.includes("은밀");
      });
      if (stealthEffect) return true;
    }
  }
  
  // token.document.effects에서 stealth 찾기
  if (token.document.effects) {
    const stealthEffect = token.document.effects.find(effect => {
      const name = effect.name?.toLowerCase() || effect.label?.toLowerCase() || "";
      return name.includes("stealth") || name.includes("은밀");
    });
    if (stealthEffect) return true;
  }
  
  return false;
}
  
  /**
   * 아이템 시트 렌더링 후 헤더에 타게팅 버튼 추가
   */
  Hooks.on("renderItemSheet", (app, html, data) => {
    if (!app.item) return;
    
    // double-cross-3rd 시스템이 아닌 경우 무시
    if (game.system.id !== "double-cross-3rd") return;
    
    // 콤보, 이펙트, 스펠, 사이오닉 타입만 처리
    const targetTypes = ["combo", "effect", "spell", "psionic"];
    if (!targetTypes.includes(app.item.type)) return;
    
    const windowHeader = html.find(".window-header");
    if (!windowHeader.length) return;
    
    // 이미 버튼이 추가되어 있는지 확인
    if (windowHeader.find(".target-assistant-button").length > 0) return;
    
    // 타게팅 버튼 생성 (참고 파일과 동일한 방식)
    const targetingButton = $(`
      <a class="target-assistant-button" title="${game.i18n.localize("DX3RD-TARGET-ASSISTANT.Targeting")}">
        <i class="fa-solid fa-bullseye"></i>${game.i18n.localize("DX3RD-TARGET-ASSISTANT.Targeting")}
      </a>
    `);
    
    // 버튼 클릭 이벤트
    targetingButton.on("click", () => {
      // 아이템 시트의 액터 정보 가져오기
      const actor = app.actor || app.item?.actor || null;
      handleTargeting(app.item, actor);
    });
    
    // 닫기 버튼 바로 앞에 추가
    const closeButton = windowHeader.find(".close");
    if (closeButton.length) {
      closeButton.before(targetingButton);
    } else {
      windowHeader.append(targetingButton);
    }
  });
  
  /**
   * 타게팅 처리 함수
   */
  async function handleTargeting(item, actor = null) {
    await showTargetingDialog(item, actor);
  }

  /**
   * 아이템 사용 시 타게팅 자동 실행
   * createChatMessage 훅에서 메시지 content를 확인하여 아이템 사용 메시지인지 판단
   */
  Hooks.on("createChatMessage", async (message, options, userId) => {
    // double-cross-3rd 시스템이 아닌 경우 무시
    if (game.system.id !== "double-cross-3rd") return;
    
    // 자신이 생성한 메시지가 아닌 경우 무시
    if (userId !== game.userId) return;
    
    // 메시지에 speaker.actor가 없는 경우 무시
    if (!message.speaker?.actor) return;
    
    const actor = game.actors.get(message.speaker.actor);
    if (!actor) return;
    
    // 메시지 content가 문자열인지 확인하고, dx3rd-item-chat 클래스가 있는지 확인
    const content = message.content;
    if (!content || typeof content !== "string") return;
    
    // dx3rd-item-chat 클래스가 있는지 확인
    if (!content.includes('dx3rd-item-chat')) return;
    
    // item-name-toggle 클래스가 있는지 확인 (실제 아이템 사용 메시지인지 확인)
    if (!content.includes('item-name-toggle')) return;
    
    // item-details나 item-actions가 있어야 실제 아이템 사용 메시지임
    if (!content.includes('item-details') && !content.includes('item-actions')) return;
    
    // HTML 파싱하여 아이템 이름 추출
    const $content = $('<div>').html(content);
    const itemNameElement = $content.find('.item-name-toggle').first();
    if (!itemNameElement.length) return;
    
    // 아이템 이름 추출 (로이스 타입 [D], [M] 등 제거)
    let itemName = itemNameElement.text().trim();
    // [로이스타입] 패턴 제거
    itemName = itemName.replace(/^\[.*?\]/, '').trim();
    
    if (!itemName) return;
    
    // 액터의 아이템 중에서 이름이 일치하는 것 찾기
    const item = actor.items.find(i => {
      const targetTypes = ["combo", "effect", "spell", "psionic"];
      if (!targetTypes.includes(i.type)) return false;
      // 이름 비교 (루비 텍스트 제거)
      const itemNameClean = i.name.replace(/[|｜].*$/, '').trim();
      return itemNameClean === itemName || i.name === itemName;
    });
    
    if (!item) return;
    
    // 저장된 타게팅 설정 확인
    const savedTargeting = item.getFlag(MODULE_ID, "targeting");
    if (!savedTargeting) return;
    
    // 약간의 딜레이 후 타게팅 실행 (메시지가 완전히 렌더링된 후)
    setTimeout(async () => {
      // 전투 중에만 활성화 설정이 켜져있고 전투가 없으면 실행하지 않음
      if (shouldRequireCombat() && !isInCombat()) {
        return;
      }
      
      if (savedTargeting.targetType === "Single") {
        await executeSingleTargeting(item, actor);
      } else if (savedTargeting.targetType === "N" && savedTargeting.parsedNValue) {
        await executeNTargeting(item, actor, savedTargeting.parsedNValue);
      } else if (savedTargeting.targetType === "Area" || savedTargeting.targetType === "Area(Enemies)" || savedTargeting.targetType === "Area(Allies)") {
        await executeAreaTargeting(item, actor);
      } else if (savedTargeting.targetType === "Scene" || savedTargeting.targetType === "Scene(Enemies)" || savedTargeting.targetType === "Scene(Allies)") {
        await executeSceneTargeting(item, actor);
      }
    }, 100);
  });

  /**
   * 타게팅 다이얼로그 표시
   */
  async function showTargetingDialog(item, actorParam = null) {
    const itemType = item.type;
    const isCombo = itemType === "combo";
    const isSpell = itemType === "spell";
    const isEffectOrPsionic = itemType === "effect" || itemType === "psionic";
    
    // 액터 찾기
    let actor = actorParam || item.actor || game.actors.find(a => a.items.has(item.id));
    
    // 콤보에 포함된 이펙트 목록 가져오기
    let comboEffects = [];
    if (isCombo && actor) {
      console.log("DX3RD-TARGET-ASSISTANT | 콤보 이펙트 찾기 시작, 액터:", actor.name);
      comboEffects = getComboEffects(item, actor);
      console.log("DX3RD-TARGET-ASSISTANT | 찾은 이펙트 개수:", comboEffects.length);
    }
    
    // 저장된 타게팅 설정 불러오기
    const savedTargeting = item.getFlag("lichsoma-dx3rd-target-assistant", "targeting") || {};
    const savedTargetType = savedTargeting.targetType || "-";
    const savedNValue = savedTargeting.nValue || "";
    const savedIgnoreStealth = savedTargeting.ignoreStealth || false;
    const savedExcludeSelf = savedTargeting.excludeSelf || false;
    
    // N 값 placeholder 결정
    let nValuePlaceholder;
    if (isCombo) {
      nValuePlaceholder = game.i18n.localize("DX3RD-TARGET-ASSISTANT.NValueComboPlaceholder");
    } else if (isSpell) {
      nValuePlaceholder = game.i18n.localize("DX3RD-TARGET-ASSISTANT.NValueSpellPlaceholder");
    } else {
      nValuePlaceholder = game.i18n.localize("DX3RD-TARGET-ASSISTANT.NValuePlaceholder");
    }
    
    // 다이얼로그 HTML 생성
    const content = await renderTemplate("modules/lichsoma-dx3rd-target-assistant/templates/targeting-dialog.html", {
      item: item,
      isCombo: isCombo,
      isSpell: isSpell,
      isEffectOrPsionic: isEffectOrPsionic,
      comboEffects: comboEffects,
      nValuePlaceholder: nValuePlaceholder,
      savedTargetType: savedTargetType,
      savedNValue: savedNValue,
      savedIgnoreStealth: savedIgnoreStealth,
      savedExcludeSelf: savedExcludeSelf,
      i18n: {
        TargetType: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetType"),
        TargetTypeNone: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeNone"),
        TargetTypeSingle: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeSingle"),
        TargetTypeN: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeN"),
        TargetTypeArea: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeArea"),
        TargetTypeAreaEnemies: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeAreaEnemies"),
        TargetTypeAreaAllies: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeAreaAllies"),
        TargetTypeScene: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeScene"),
        TargetTypeSceneEnemies: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeSceneEnemies"),
        TargetTypeSceneAllies: game.i18n.localize("DX3RD-TARGET-ASSISTANT.TargetTypeSceneAllies"),
        NValue: game.i18n.localize("DX3RD-TARGET-ASSISTANT.NValue"),
        Level: game.i18n.localize("DX3RD-TARGET-ASSISTANT.Level"),
        AvailableEffects: game.i18n.localize("DX3RD-TARGET-ASSISTANT.AvailableEffects"),
        Cancel: game.i18n.localize("DX3RD-TARGET-ASSISTANT.Cancel"),
        Confirm: game.i18n.localize("DX3RD-TARGET-ASSISTANT.Confirm"),
        IgnoreStealth: game.i18n.localize("DX3RD-TARGET-ASSISTANT.IgnoreStealth"),
        ExcludeSelf: game.i18n.localize("DX3RD-TARGET-ASSISTANT.ExcludeSelf")
      }
    });
    
    // 다이얼로그 생성
    new Dialog({
      title: `${game.i18n.localize("DX3RD-TARGET-ASSISTANT.Targeting")}: ${item.name}`,
      content: content,
      buttons: {
        confirm: {
          icon: '<i class="fa-solid fa-check"></i>',
          label: game.i18n.localize("DX3RD-TARGET-ASSISTANT.Confirm"),
          callback: async (html) => {
            const formData = new FormData(html[0].querySelector("form"));
            const targetType = formData.get("targetType");
            const nValue = formData.get("nValue");
            const ignoreStealth = formData.get("ignoreStealth") === "on";
            const excludeSelf = formData.get("excludeSelf") === "on";
            
            // N 타입인 경우 N 값 처리
            let finalNValue = null;
            let rawNValue = null;
            if (targetType === "N") {
              rawNValue = nValue;
              // 액터 파라미터 사용 (없으면 찾기)
              const currentActor = actorParam || item.actor || game.actors.find(a => a.items.has(item.id));
              const currentComboEffects = isCombo && currentActor ? getComboEffects(item, currentActor) : [];
              const parsedN = await parseNValue(nValue, item, null, currentComboEffects);
              if (parsedN === null) {
                ui.notifications.error(game.i18n.localize("DX3RD-TARGET-ASSISTANT.InvalidNValue"));
                return;
              }
              finalNValue = parsedN;
            }
            
            // Flag로 저장
            await item.setFlag("lichsoma-dx3rd-target-assistant", "targeting", {
              targetType: targetType,
              nValue: rawNValue || null,
              parsedNValue: finalNValue,
              ignoreStealth: ignoreStealth,
              excludeSelf: excludeSelf
            });
            
            // 다이얼로그에서는 저장만 하고 타게팅은 실행하지 않음
            // 타게팅은 아이템 사용 시 자동으로 실행됨
          }
        },
        cancel: {
          icon: '<i class="fa-solid fa-xmark"></i>',
          label: game.i18n.localize("DX3RD-TARGET-ASSISTANT.Cancel"),
          callback: () => {}
        }
      },
      render: (html) => {
        // 저장된 값 설정
        const targetTypeSelect = html.find("#targetType");
        const nValueInput = html.find("#nValue");
        const excludeSelfCheckbox = html.find("#excludeSelf");
        
        // 저장된 타겟 타입 설정
        if (savedTargetType) {
          targetTypeSelect.val(savedTargetType);
        }
        
        // N 타입 선택 시 N 값 입력 필드 활성화/비활성화
        const updateNValueInput = () => {
          const selectedType = targetTypeSelect.val();
          if (selectedType === "N") {
            nValueInput.prop("disabled", false);
            // 저장된 N 값이 있고 타입이 N이면 값 설정
            if (savedTargetType === "N" && savedNValue) {
              nValueInput.val(savedNValue);
            }
          } else {
            nValueInput.prop("disabled", true);
            // 다른 타입 선택 시 입력값 초기화
            nValueInput.val("");
          }
        };
        
        // 자신 제외 체크박스 활성화/비활성화 및 체크 해제
        const updateExcludeSelfCheckbox = () => {
          const selectedType = targetTypeSelect.val();
          if (selectedType === "Area" || selectedType === "Area(Allies)" || selectedType === "Scene" || selectedType === "Scene(Allies)") {
            excludeSelfCheckbox.prop("disabled", false);
            // 저장된 값이 있고 타입이 Area, Area(Allies), Scene, Scene(Allies)이면 값 설정
            if ((savedTargetType === "Area" || savedTargetType === "Area(Allies)" || savedTargetType === "Scene" || savedTargetType === "Scene(Allies)") && savedExcludeSelf) {
              excludeSelfCheckbox.prop("checked", true);
            }
          } else {
            excludeSelfCheckbox.prop("disabled", true);
            excludeSelfCheckbox.prop("checked", false);
          }
        };
        
        targetTypeSelect.on("change", () => {
          updateNValueInput();
          updateExcludeSelfCheckbox();
        });
        
        // 초기 상태 설정
        updateNValueInput();
        updateExcludeSelfCheckbox();
      },
      default: "confirm"
    }, {
      width: 400
    }).render(true);
  }

  /**
   * 콤보에 포함된 이펙트 목록 가져오기
   */
  function getComboEffects(comboItem, actor = null) {
    const effects = [];
    
    // 액터 찾기 (아이템이 속한 액터)
    if (!actor) {
      // 아이템이 액터에 속해있는 경우
      if (comboItem.actor) {
        actor = comboItem.actor;
      } else {
        // 모든 액터에서 이 콤보 아이템을 가진 액터 찾기
        const foundActor = game.actors.find(a => a.items.has(comboItem.id));
        if (foundActor) {
          actor = foundActor;
        }
      }
    }
    
    if (!actor) {
      console.warn("DX3RD-TARGET-ASSISTANT | 콤보 아이템의 액터를 찾을 수 없습니다.");
      return effects;
    }
    
    // 여러 가능한 구조 확인
    const systemData = comboItem.system || comboItem.data?.data || {};
    
    console.log("DX3RD-TARGET-ASSISTANT | 콤보 systemData:", systemData);
    console.log("DX3RD-TARGET-ASSISTANT | systemData.effect:", systemData.effect);
    console.log("DX3RD-TARGET-ASSISTANT | systemData.effectIds:", systemData.effectIds);
    
    // system.effectIds 배열 확인 (double-cross-3rd 시스템의 실제 구조)
    if (systemData.effectIds && Array.isArray(systemData.effectIds)) {
      console.log("DX3RD-TARGET-ASSISTANT | system.effectIds 배열 발견, 길이:", systemData.effectIds.length);
      for (const effectId of systemData.effectIds) {
        console.log("DX3RD-TARGET-ASSISTANT | 이펙트 ID:", effectId);
        if (effectId && effectId !== '-') {
          // 액터의 아이템에서 찾기
          const effect = actor.items.get(effectId);
          console.log("DX3RD-TARGET-ASSISTANT | 찾은 이펙트:", effect ? effect.name : "없음");
          if (effect && (effect.type === "effect" || effect.type === "psionic")) {
            effects.push(effect);
            console.log("DX3RD-TARGET-ASSISTANT | 이펙트 추가됨:", effect.name);
          }
        }
      }
    }
    
    // system.effect 배열 확인 (다른 구조일 수도 있음)
    if (systemData.effect && Array.isArray(systemData.effect)) {
      console.log("DX3RD-TARGET-ASSISTANT | system.effect 배열 발견, 길이:", systemData.effect.length);
      for (const effectId of systemData.effect) {
        console.log("DX3RD-TARGET-ASSISTANT | 이펙트 ID:", effectId);
        if (effectId && effectId !== '-') {
          // 액터의 아이템에서 찾기
          const effect = actor.items.get(effectId);
          console.log("DX3RD-TARGET-ASSISTANT | 찾은 이펙트:", effect ? effect.name : "없음");
          if (effect && (effect.type === "effect" || effect.type === "psionic")) {
            effects.push(effect);
            console.log("DX3RD-TARGET-ASSISTANT | 이펙트 추가됨:", effect.name);
          }
        }
      }
    }
    
    // effects 배열 확인 (다른 구조일 수도 있음)
    if (systemData.effects && Array.isArray(systemData.effects)) {
      for (const effectRef of systemData.effects) {
        if (typeof effectRef === "string") {
          // ID인 경우 - 액터의 아이템에서 찾기
          const effect = actor.items.get(effectRef);
          if (effect && (effect.type === "effect" || effect.type === "psionic")) {
            effects.push(effect);
          }
        } else if (effectRef.id) {
          // 객체인 경우
          const effect = actor.items.get(effectRef.id);
          if (effect && (effect.type === "effect" || effect.type === "psionic")) {
            effects.push(effect);
          }
        } else if (effectRef.name) {
          // 이름으로 찾기 - 액터의 아이템에서 찾기
          const effect = actor.items.find(i => 
            i.name === effectRef.name && (i.type === "effect" || i.type === "psionic")
          );
          if (effect) {
            effects.push(effect);
          }
        }
      }
    }
    
    // items 배열 확인 (다른 구조일 수도 있음)
    if (systemData.items && Array.isArray(systemData.items)) {
      for (const itemRef of systemData.items) {
        const itemId = typeof itemRef === "string" ? itemRef : (itemRef.id || itemRef._id);
        if (itemId) {
          const item = actor.items.get(itemId);
          if (item && (item.type === "effect" || item.type === "psionic")) {
            effects.push(item);
          }
        }
      }
    }
    
    return effects;
  }

  /**
   * 레벨 데이터에서 숫자 값 추출
   */
  function extractLevelValue(levelData) {
    if (levelData === null || levelData === undefined) return null;
    
    let level = null;
    if (typeof levelData === 'object' && levelData !== null) {
      level = levelData.value !== undefined ? Number(levelData.value) : (levelData.init !== undefined ? Number(levelData.init) : null);
    } else {
      level = Number(levelData);
    }
    
    if (level !== null && !isNaN(level) && level > 0) {
      return level;
    }
    return null;
  }

  /**
   * 참조 값을 숫자로 변환 ([level], [이펙트 이름])
   */
  function resolveReference(ref, item, comboEffects) {
    // [level] 체크
    if (ref.toLowerCase() === 'level') {
      if (item.type === "effect" || item.type === "psionic") {
        const levelData = item.system?.level || item.data?.data?.level || null;
        return extractLevelValue(levelData);
      }
      return null;
    }
    
    // [이펙트 이름] 체크 (콤보인 경우만)
    if (item.type === "combo") {
      // 정확한 이름 매칭 시도
      let effect = comboEffects.find(e => e.name === ref);
      
      // 정확한 매칭이 없으면 루비 텍스트 제거 후 매칭 시도
      if (!effect) {
        const refClean = ref.replace(/[|｜].*$/, '').trim();
        effect = comboEffects.find(e => {
          const eNameClean = e.name.replace(/[|｜].*$/, '').trim();
          return eNameClean === refClean || e.name === ref;
        });
      }
      
      if (effect) {
        const levelData = effect.system?.level || effect.data?.data?.level || null;
        return extractLevelValue(levelData);
      }
    }
    
    return null;
  }

  /**
   * 안전한 수식 평가 (+, -, *, / 만 지원)
   */
  function evaluateExpression(expression) {
    try {
      // 숫자와 연산자만 허용하는 정규식
      const safePattern = /^[\d+\-*/().\s]+$/;
      if (!safePattern.test(expression)) {
        return null;
      }
      
      // Function 생성자를 사용하여 안전하게 평가
      const result = new Function('return ' + expression)();
      
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        return Math.floor(result); // 정수로 반환
      }
      return null;
    } catch (error) {
      console.error("DX3RD-TARGET-ASSISTANT | 수식 평가 오류:", error);
      return null;
    }
  }

  /**
   * N 값 파싱 (수식 지원)
   */
  async function parseNValue(nValue, item, selectedEffectId, comboEffects) {
    if (!nValue || nValue.trim() === "") {
      return null;
    }
    
    const trimmedValue = nValue.trim();
    
    // 단순 숫자 체크 (수식이 아닌 경우)
    const simpleNumPattern = /^\d+$/;
    if (simpleNumPattern.test(trimmedValue)) {
      const numValue = parseInt(trimmedValue, 10);
      if (numValue >= 1 && numValue <= 99) {
        return numValue;
      }
      return null;
    }
    
    // 참조 패턴 찾기 ([level], [이펙트 이름])
    const referencePattern = /\[([^\]]+)\]/g;
    let expression = trimmedValue;
    let hasReference = false;
    
    // 모든 참조를 숫자로 치환
    const references = [];
    let match;
    while ((match = referencePattern.exec(trimmedValue)) !== null) {
      references.push(match[1].trim());
    }
    
    // 각 참조를 숫자로 변환
    for (const ref of references) {
      const value = resolveReference(ref, item, comboEffects);
      if (value !== null) {
        expression = expression.replace(`[${ref}]`, value.toString());
        hasReference = true;
      } else {
        // 참조를 해결할 수 없으면 실패
        console.log("DX3RD-TARGET-ASSISTANT | 참조를 해결할 수 없음:", ref);
        return null;
      }
    }
    
    // 수식이 있는 경우 평가
    if (hasReference || /[+\-*/]/.test(expression)) {
      const result = evaluateExpression(expression);
      if (result !== null && result >= 1 && result <= 99) {
        console.log("DX3RD-TARGET-ASSISTANT | 수식 평가 결과:", expression, "=", result);
        return result;
      }
      return null;
    }
    
    // 참조만 있는 경우 (예: [level])
    if (references.length === 1 && expression.match(/^\d+$/)) {
      const numValue = parseInt(expression, 10);
      if (numValue >= 1 && numValue <= 99) {
        return numValue;
      }
    }
    
    return null;
  }

  /**
   * 타게팅 실행
   */
  async function executeTargeting(item, targetType, nValue) {
    // 단일 타겟 또는 N 타겟의 경우 자동 실행
    if (targetType === "Single") {
      // 다이얼로그에서 실행하는 경우이므로 액터 파라미터 없이 실행
      await executeSingleTargeting(item);
    } else if (targetType === "N" && nValue !== null) {
      // 다이얼로그에서 실행하는 경우이므로 액터 파라미터 없이 실행
      await executeNTargeting(item, null, nValue);
    } else {
      console.log("DX3RD-TARGET-ASSISTANT | 타게팅 설정 저장됨:", {
        item: item.name,
        targetType: targetType,
        nValue: nValue
      });
    }
  }

  /**
   * 단일 타겟 타게팅 실행
   */
  async function executeSingleTargeting(item, actorParam = null) {
    console.log("DX3RD-TARGET-ASSISTANT | 단일 타겟 타게팅 시작");
    
    // 저장된 타게팅 설정 확인
    const savedTargeting = item.getFlag(MODULE_ID, "targeting") || {};
    const ignoreStealth = savedTargeting.ignoreStealth || false;
    
    // 전투 중에만 활성화 설정 확인
    if (shouldRequireCombat() && !isInCombat()) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CombatRequired"));
      return;
    }
    
    // Sequencer 모듈 확인
    if (!window.Sequencer) {
      ui.notifications.error("Sequencer 모듈이 로드되지 않았습니다.");
      return;
    }
    
    // 캔버스가 준비될 때까지 대기
    let retries = 0;
    const maxRetries = 50; // 최대 5초 대기 (100ms * 50)
    
    while (!canvas?.ready && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CanvasNotReady"));
      return;
    }
    
    // 하이라이트 표시 딜레이를 위한 추가 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    // 액터 파라미터가 있으면 해당 액터의 토큰 찾기, 없으면 선택된 토큰 사용
    let sourceToken = null;
    let actor = null;
    let savedTokenIds = [];
    
    if (actorParam) {
      // 액터 파라미터가 있으면 해당 액터의 토큰 찾기
      actor = actorParam;
      const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
      if (tokens.length > 0) {
        sourceToken = tokens[0];
        // 해당 토큰 선택
        sourceToken.control({ releaseOthers: true });
        savedTokenIds = [sourceToken.id];
      } else {
        ui.notifications.warn("액터에 해당하는 토큰을 찾을 수 없습니다.");
        return;
      }
    } else {
      // 액터 파라미터가 없으면 선택된 토큰 사용 (수동 실행 시)
      const controlledTokens = canvas.tokens.controlled;
      if (controlledTokens.length === 0) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.NoTokenSelected"));
        return;
      }
      
      sourceToken = controlledTokens[0];
      actor = sourceToken.actor;
      
      if (!actor) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.ActorNotFound"));
        return;
      }
      
      savedTokenIds = controlledTokens.map(t => t.id);
    }

    // 기존 타겟 해제
    for (const t of Array.from(game.user.targets)) {
      t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true });
    }

    // 범위 하이라이트 정보 가져오기 (아이템 호출 시에만 체크)
    let rangeHighlightData = null;
    let range = 1;
    let hasRangeHighlight = false;
    const universalHandler = window.DX3rdUniversalHandler;
    
    // 아이템 호출 시(actorParam이 있을 때)만 범위 하이라이트 체크
    if (actorParam && universalHandler && universalHandler.rangeHighlightQueue) {
      const queue = universalHandler.rangeHighlightQueue;
      
      if (Array.isArray(queue)) {
        rangeHighlightData = queue.find(item => 
          item.actorId === actor.id || item.tokenId === sourceToken.id
        );
      } else if (typeof queue === "object" && queue !== null) {
        const queueArray = Object.values(queue);
        rangeHighlightData = queueArray.find(item => 
          item && (item.actorId === actor.id || item.tokenId === sourceToken.id)
        );
      }
      
      if (rangeHighlightData) {
        range = rangeHighlightData.range || 1;
        hasRangeHighlight = true;
      }
    }

    // 하이라이트된 그리드 목록 가져오기 (범위 하이라이트가 있을 때만)
    function getHighlightedGridSet() {
      if (!hasRangeHighlight || !universalHandler) return null;
      
      let highlightedGrids = [];
      if (range === 1) {
        highlightedGrids = universalHandler.getAdjacentGrids(sourceToken);
      } else {
        highlightedGrids = universalHandler.getGridsInRange(sourceToken, range);
      }
      
      const highlightedSet = new Set();
      for (const grid of highlightedGrids) {
        const gridOffset = canvas.grid.getOffset({ x: grid.x, y: grid.y });
        highlightedSet.add(`${gridOffset.i},${gridOffset.j}`);
      }
      return highlightedSet;
    }

    // 위치가 하이라이트 범위 내에 있는지 확인 (범위 하이라이트가 있을 때만)
    function isLocationInRange(location) {
      if (!hasRangeHighlight) return true; // 범위 하이라이트가 없으면 제한 없음
      
      const highlightedSet = getHighlightedGridSet();
      if (!highlightedSet) return true; // 그리드 세트를 가져올 수 없으면 제한 없음
      
      const locationOffset = canvas.grid.getOffset({ x: location.x, y: location.y });
      const locationKey = `${locationOffset.i},${locationOffset.j}`;
      return highlightedSet.has(locationKey);
    }

    // 1x1 = 그리드 1칸
    const sizeInSquares = 1;
    const pxSize = canvas.grid.size * sizeInSquares;
    const crosshairImage = getCrosshairImage();
    const crosshairSizeMultiplier = getCrosshairSize();
    const crosshairAlpha = getCrosshairAlpha();
    
    console.log("DX3RD-TARGET-ASSISTANT | 크로스헤어 이미지:", crosshairImage, "크기:", crosshairSizeMultiplier, "투명도:", crosshairAlpha);

    // 크로스헤어 활성화 상태 추적
    let isCrosshairActive = false;
    let originalReleaseAll = null;
    let tokenReleaseHandler = null;
    
    // 토큰 선택 해제 방지 함수
    const preventTokenRelease = (event) => {
      if (!isCrosshairActive) return;
      
      // 크로스헤어가 활성화된 동안 토큰 선택 해제 방지
      const controlledTokens = canvas.tokens.controlled;
      const hasSavedTokens = savedTokenIds.some(id => {
        const token = canvas.tokens.get(id);
        return token && token.controlled;
      });
      
      if (hasSavedTokens) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    };
    
    // canvas.tokens.releaseAll 메서드 오버라이드
    const preventReleaseAll = function(releaseOthers = true) {
      if (isCrosshairActive) {
        // 크로스헤어가 활성화된 동안은 releaseAll 무시
        return;
      }
      // 원래 메서드 호출
      if (originalReleaseAll) {
        return originalReleaseAll.call(this, releaseOthers);
      }
    };

    // 템플릿을 찍을 위치 선택 (크로스헤어) - 범위 내에서만 선택 가능
    let pos = null;
    let isValidPosition = false;
    let hasValidTargets = false;

    while (!isValidPosition || !hasValidTargets) {
      try {
        // 크로스헤어 활성화 시작
        isCrosshairActive = true;
        
        // 토큰 선택 해제 방지 설정
        originalReleaseAll = canvas.tokens.releaseAll;
        canvas.tokens.releaseAll = preventReleaseAll;
        
        // 마우스 이벤트로 인한 토큰 선택 해제 방지
        tokenReleaseHandler = (event) => {
          if (!isCrosshairActive) return;
          
          // 빈 공간 클릭으로 인한 선택 해제 방지
          const target = event.target;
          if (target && typeof target.classList === 'object' && target.classList) {
            const isBoardOrBackground = target.classList.contains("board") || target.classList.contains("background");
            
            if (isBoardOrBackground) {
              const controlledTokens = canvas.tokens.controlled;
              const hasSavedTokens = savedTokenIds.some(id => {
                const token = canvas.tokens.get(id);
                return token && token.controlled;
              });
              
              if (hasSavedTokens) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
              }
            }
          }
        };
        
        // 이벤트 리스너 추가
        canvas.app.stage.on("mousedown", tokenReleaseHandler);
        
        pos = await Sequencer.Crosshair.show(
          {
            size: sizeInSquares,
            gridHighlight: false,
            label: { text: "" },
            borderColor: "#000000",
            borderAlpha: 0,
            fillColor: "#000000",
            fillAlpha: 0,
          },
          {
            show: async (crosshair) => {
              console.log("DX3RD-TARGET-ASSISTANT | 크로스헤어 표시 중:", crosshair);
              try {
                await new Sequence()
                  .effect()
                  .file(crosshairImage)
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .aboveLighting()
                  .play();
              } catch (error) {
                console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 이미지 로드 오류:", error);
                // 기본 이미지로 재시도
                await new Sequence()
                  .effect()
                  .file("icons/svg/target.svg")
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .aboveLighting()
                  .play();
              }
            }
          }
        );
        
        // 크로스헤어가 닫혔으므로 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
      } catch (error) {
        console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 표시 오류:", error);
        ui.notifications.error("크로스헤어를 표시할 수 없습니다: " + error.message);
        
        // 에러 발생 시에도 크로스헤어 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        return;
      }

      if (!pos) {
        // 크로스헤어가 취소되었으므로 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        return;
      }

      // 선택한 위치가 하이라이트 범위 내에 있는지 확인 (범위 하이라이트가 있을 때만)
      if (isLocationInRange(pos)) {
        isValidPosition = true;
      } else {
        // 범위 하이라이트가 있을 때만 경고 표시
        if (hasRangeHighlight) {
          ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.OutOfRange"));
        } else {
          // 범위 하이라이트가 없으면 항상 유효한 위치로 간주
          isValidPosition = true;
        }
      }

      // 유효한 위치일 때만 타겟 확인
      if (isValidPosition) {
        // 선택한 위치(크로스헤어 중심)를 기준으로 1x1 범위의 좌상단 계산
        const halfSize = canvas.grid.size * (sizeInSquares / 2);
        const topLeft = {
          x: pos.x - halfSize,
          y: pos.y - halfSize
        };

        const rect = {
          x1: topLeft.x,
          y1: topLeft.y,
          x2: topLeft.x + pxSize,
          y2: topLeft.y + pxSize,
        };

        // 두 사각형이 겹치는지 확인하는 함수
        function rectanglesIntersect(rect1, rect2) {
          return !(rect1.x2 <= rect2.x1 || 
                   rect1.x1 >= rect2.x2 || 
                   rect1.y2 <= rect2.y1 || 
                   rect1.y1 >= rect2.y2);
        }

        const targets = canvas.tokens.placeables.filter((token) => {
          if (!token?.actor) return false;
          
          // hide된 토큰은 무조건 제외
          if (isTokenHidden(token)) {
            return false;
          }
          
          // 은밀 무시 설정이 체크되지 않았고 stealth 컨디션이 있으면 제외
          if (!ignoreStealth && hasStealthCondition(token)) {
            return false;
          }
          
          const tokenWidth = token.w || (token.document.width * canvas.grid.size);
          const tokenHeight = token.h || (token.document.height * canvas.grid.size);
          const tokenRect = {
            x1: token.x,
            y1: token.y,
            x2: token.x + tokenWidth,
            y2: token.y + tokenHeight
          };
          
          return rectanglesIntersect(rect, tokenRect);
        });

        // 타겟이 없으면 다시 크로스헤어 표시
        if (targets.length === 0) {
          hasValidTargets = false;
          isValidPosition = false; // 위치를 다시 선택하도록
          continue;
        }

        hasValidTargets = true;

        for (const token of targets) {
          token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
        }
      }
    }
    
    // 크로스헤어 비활성화
    isCrosshairActive = false;
    
    // 토큰 선택 해제 방지 해제
    if (originalReleaseAll) {
      canvas.tokens.releaseAll = originalReleaseAll;
      originalReleaseAll = null;
    }
    
    if (tokenReleaseHandler) {
      canvas.app.stage.off("mousedown", tokenReleaseHandler);
      tokenReleaseHandler = null;
    }
    
    // 선택한 토큰 다시 선택
    for (const tokenId of savedTokenIds) {
      const savedToken = canvas.tokens.get(tokenId);
      if (savedToken) {
        savedToken.control({ releaseOthers: false });
      }
    }
  }

  /**
   * N 타겟 타게팅 실행
   */
  async function executeNTargeting(item, actorParam = null, nValue) {
    // 저장된 타게팅 설정 확인
    const savedTargeting = item.getFlag(MODULE_ID, "targeting") || {};
    const ignoreStealth = savedTargeting.ignoreStealth || false;
    
    // 전투 중에만 활성화 설정 확인
    if (shouldRequireCombat() && !isInCombat()) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CombatRequired"));
      return;
    }
    
    // N값이 객체인 경우 숫자로 변환
    let nValueNum = nValue;
    if (typeof nValue === 'object' && nValue !== null) {
      nValueNum = nValue.value !== undefined ? Number(nValue.value) : (nValue.init !== undefined ? Number(nValue.init) : null);
      if (isNaN(nValueNum) || nValueNum <= 0) {
        ui.notifications.error("N 값이 올바르지 않습니다.");
        return;
      }
    } else {
      nValueNum = Number(nValue);
      if (isNaN(nValueNum) || nValueNum <= 0) {
        ui.notifications.error("N 값이 올바르지 않습니다.");
        return;
      }
    }
    
    console.log("DX3RD-TARGET-ASSISTANT | N 타겟 타게팅 시작, N값:", nValueNum);
    
    // Sequencer 모듈 확인
    if (!window.Sequencer) {
      ui.notifications.error("Sequencer 모듈이 로드되지 않았습니다.");
      return;
    }
    
    // 캔버스가 준비될 때까지 대기
    let retries = 0;
    const maxRetries = 50;
    
    while (!canvas?.ready && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CanvasNotReady"));
      return;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));

    // 액터 파라미터가 있으면 해당 액터의 토큰 찾기, 없으면 선택된 토큰 사용
    let sourceToken = null;
    let actor = null;
    let savedTokenIds = [];
    
    if (actorParam) {
      actor = actorParam;
      const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
      if (tokens.length > 0) {
        sourceToken = tokens[0];
        sourceToken.control({ releaseOthers: true });
        savedTokenIds = [sourceToken.id];
      } else {
        ui.notifications.warn("액터에 해당하는 토큰을 찾을 수 없습니다.");
        return;
      }
    } else {
      const controlledTokens = canvas.tokens.controlled;
      if (controlledTokens.length === 0) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.NoTokenSelected"));
        return;
      }
      
      sourceToken = controlledTokens[0];
      actor = sourceToken.actor;
      
      if (!actor) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.ActorNotFound"));
        return;
      }
      
      savedTokenIds = controlledTokens.map(t => t.id);
    }

    // 기존 타겟 해제
    for (const t of Array.from(game.user.targets)) {
      t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true });
    }

    // 범위 하이라이트 정보 가져오기 (아이템 호출 시에만 체크)
    let rangeHighlightData = null;
    let range = 1;
    let hasRangeHighlight = false;
    const universalHandler = window.DX3rdUniversalHandler;
    
    if (actorParam && universalHandler && universalHandler.rangeHighlightQueue) {
      const queue = universalHandler.rangeHighlightQueue;
      
      if (Array.isArray(queue)) {
        rangeHighlightData = queue.find(item => 
          item.actorId === actor.id || item.tokenId === sourceToken.id
        );
      } else if (typeof queue === "object" && queue !== null) {
        const queueArray = Object.values(queue);
        rangeHighlightData = queueArray.find(item => 
          item && (item.actorId === actor.id || item.tokenId === sourceToken.id)
        );
      }
      
      if (rangeHighlightData) {
        range = rangeHighlightData.range || 1;
        hasRangeHighlight = true;
      }
    }

    // 하이라이트된 그리드 목록 가져오기 (범위 하이라이트가 있을 때만)
    function getHighlightedGridSet() {
      if (!hasRangeHighlight || !universalHandler) return null;
      
      let highlightedGrids = [];
      if (range === 1) {
        highlightedGrids = universalHandler.getAdjacentGrids(sourceToken);
      } else {
        highlightedGrids = universalHandler.getGridsInRange(sourceToken, range);
      }
      
      const highlightedSet = new Set();
      for (const grid of highlightedGrids) {
        const gridOffset = canvas.grid.getOffset({ x: grid.x, y: grid.y });
        highlightedSet.add(`${gridOffset.i},${gridOffset.j}`);
      }
      return highlightedSet;
    }

    // 위치가 하이라이트 범위 내에 있는지 확인
    function isLocationInRange(location) {
      if (!hasRangeHighlight) return true;
      
      const highlightedSet = getHighlightedGridSet();
      if (!highlightedSet) return true;
      
      const locationOffset = canvas.grid.getOffset({ x: location.x, y: location.y });
      const locationKey = `${locationOffset.i},${locationOffset.j}`;
      return highlightedSet.has(locationKey);
    }

    // 1x1 = 그리드 1칸
    const sizeInSquares = 1;
    const pxSize = canvas.grid.size * sizeInSquares;
    const crosshairImage = getCrosshairImage();
    const crosshairSizeMultiplier = getCrosshairSize();
    const crosshairAlpha = getCrosshairAlpha();
    
    // 크로스헤어 활성화 상태 추적
    let isCrosshairActive = false;
    let originalReleaseAll = null;
    let tokenReleaseHandler = null;
    
    // canvas.tokens.releaseAll 메서드 오버라이드
    const preventReleaseAll = function(releaseOthers = true) {
      if (isCrosshairActive) {
        return;
      }
      if (originalReleaseAll) {
        return originalReleaseAll.call(this, releaseOthers);
      }
    };
    
    // 이미 타겟으로 설정된 토큰 ID 추적
    const selectedTargetIds = new Set();
    let isComplete = false;

    // N개까지 반복적으로 타겟 선택
    while (selectedTargetIds.size < nValueNum && !isComplete) {
      try {
        // 크로스헤어 활성화 시작
        isCrosshairActive = true;
        
        // 토큰 선택 해제 방지 설정
        originalReleaseAll = canvas.tokens.releaseAll;
        canvas.tokens.releaseAll = preventReleaseAll;
        
        // 마우스 이벤트로 인한 토큰 선택 해제 방지
        tokenReleaseHandler = (event) => {
          if (!isCrosshairActive) return;
          
          const target = event.target;
          if (target && typeof target.classList === 'object' && target.classList) {
            const isBoardOrBackground = target.classList.contains("board") || target.classList.contains("background");
            
            if (isBoardOrBackground) {
              const controlledTokens = canvas.tokens.controlled;
              const hasSavedTokens = savedTokenIds.some(id => {
                const token = canvas.tokens.get(id);
                return token && token.controlled;
              });
              
              if (hasSavedTokens) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
              }
            }
          }
        };
        
        canvas.app.stage.on("mousedown", tokenReleaseHandler);
        
        // 남은 선택 횟수 표시 (n/N 형식)
        const remaining = nValueNum - selectedTargetIds.size;
        const selected = selectedTargetIds.size;
        const labelText = remaining > 0 ? `${selected}/${nValueNum}` : `${nValueNum}/${nValueNum}`;
        
        const pos = await Sequencer.Crosshair.show(
          {
            size: sizeInSquares,
            gridHighlight: false,
            label: { text: labelText },
            borderColor: "#000000",
            borderAlpha: 0,
            fillColor: "#000000",
            fillAlpha: 0,
          },
          {
            show: async (crosshair) => {
              try {
                await new Sequence()
                  .effect()
                  .file(crosshairImage)
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .play();
              } catch (error) {
                console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 이미지 로드 오류:", error);
                await new Sequence()
                  .effect()
                  .file("icons/svg/target.svg")
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .play();
              }
            }
          }
        );
        
        // 크로스헤어 비활성화
        isCrosshairActive = false;
        
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        // pos가 null이면 우클릭으로 취소된 것
        if (!pos) {
          isComplete = true;
          break;
        }

        // 선택한 위치가 하이라이트 범위 내에 있는지 확인
        if (!isLocationInRange(pos)) {
          if (hasRangeHighlight) {
            ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.OutOfRange"));
          }
          continue;
        }

        // 선택한 위치(크로스헤어 중심)를 기준으로 1x1 범위의 좌상단 계산
        const halfSize = canvas.grid.size * (sizeInSquares / 2);
        const topLeft = {
          x: pos.x - halfSize,
          y: pos.y - halfSize
        };

        const rect = {
          x1: topLeft.x,
          y1: topLeft.y,
          x2: topLeft.x + pxSize,
          y2: topLeft.y + pxSize,
        };

        // 두 사각형이 겹치는지 확인하는 함수
        function rectanglesIntersect(rect1, rect2) {
          return !(rect1.x2 <= rect2.x1 || 
                   rect1.x1 >= rect2.x2 || 
                   rect1.y2 <= rect2.y1 || 
                   rect1.y1 >= rect2.y2);
        }

        const targets = canvas.tokens.placeables.filter((token) => {
          if (!token?.actor) return false;
          if (selectedTargetIds.has(token.id)) return false; // 이미 선택된 토큰은 제외
          
          // hide된 토큰은 무조건 제외
          if (isTokenHidden(token)) {
            return false;
          }
          
          // 은밀 무시 설정이 체크되지 않았고 stealth 컨디션이 있으면 제외
          if (!ignoreStealth && hasStealthCondition(token)) {
            return false;
          }
          
          const tokenWidth = token.w || (token.document.width * canvas.grid.size);
          const tokenHeight = token.h || (token.document.height * canvas.grid.size);
          const tokenRect = {
            x1: token.x,
            y1: token.y,
            x2: token.x + tokenWidth,
            y2: token.y + tokenHeight
          };
          
          return rectanglesIntersect(rect, tokenRect);
        });

        // 범위 내 토큰을 타겟으로 추가 (남은 개수만큼만)
        const remainingCount = nValueNum - selectedTargetIds.size;
        const tokensToAdd = targets.slice(0, remainingCount);
        
        for (const token of tokensToAdd) {
          token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
          selectedTargetIds.add(token.id);
        }
        
        // N개에 도달하면 완료
        if (selectedTargetIds.size >= nValueNum) {
          isComplete = true;
        }
        
      } catch (error) {
        console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 표시 오류:", error);
        ui.notifications.error("크로스헤어를 표시할 수 없습니다: " + error.message);
        
        isCrosshairActive = false;
        
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        break;
      }
    }
    
    // 선택한 토큰 다시 선택
    for (const tokenId of savedTokenIds) {
      const savedToken = canvas.tokens.get(tokenId);
      if (savedToken) {
        savedToken.control({ releaseOthers: false });
      }
    }
  }

  /**
   * 범위 타겟 타게팅 실행 (3x3)
   */
  async function executeAreaTargeting(item, actorParam = null) {
    console.log("DX3RD-TARGET-ASSISTANT | 범위 타겟 타게팅 시작");
    
    // 저장된 타게팅 설정 확인
    const savedTargeting = item.getFlag(MODULE_ID, "targeting") || {};
    const ignoreStealth = savedTargeting.ignoreStealth || false;
    const targetType = savedTargeting.targetType || "Area";
    const excludeSelf = savedTargeting.excludeSelf || false;
    
    // destruction 타입의 berserk 컨디션 확인 (범위(적)에서도 자신 제외 적용)
    let shouldExcludeSelfForBerserk = false;
    if (actorParam) {
      shouldExcludeSelfForBerserk = shouldExcludeSelfForDestructionBerserk(item, actorParam);
    }
    
    // 전투 중에만 활성화 설정 확인
    if (shouldRequireCombat() && !isInCombat()) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CombatRequired"));
      return;
    }
    
    // Sequencer 모듈 확인
    if (!window.Sequencer) {
      ui.notifications.error("Sequencer 모듈이 로드되지 않았습니다.");
      return;
    }
    
    // 캔버스가 준비될 때까지 대기
    let retries = 0;
    const maxRetries = 50; // 최대 5초 대기 (100ms * 50)
    
    while (!canvas?.ready && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CanvasNotReady"));
      return;
    }
    
    // 하이라이트 표시 딜레이를 위한 추가 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    // 액터 파라미터가 있으면 해당 액터의 토큰 찾기, 없으면 선택된 토큰 사용
    let sourceToken = null;
    let actor = null;
    let savedTokenIds = [];
    
    if (actorParam) {
      // 액터 파라미터가 있으면 해당 액터의 토큰 찾기
      actor = actorParam;
      const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
      if (tokens.length > 0) {
        sourceToken = tokens[0];
        // 해당 토큰 선택
        sourceToken.control({ releaseOthers: true });
        savedTokenIds = [sourceToken.id];
      } else {
        ui.notifications.warn("액터에 해당하는 토큰을 찾을 수 없습니다.");
        return;
      }
    } else {
      // 액터 파라미터가 없으면 선택된 토큰 사용 (수동 실행 시)
      const controlledTokens = canvas.tokens.controlled;
      if (controlledTokens.length === 0) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.NoTokenSelected"));
        return;
      }
      
      sourceToken = controlledTokens[0];
      actor = sourceToken.actor;
      
      if (!actor) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.ActorNotFound"));
        return;
      }
      
      savedTokenIds = controlledTokens.map(t => t.id);
    }

    // 기존 타겟 해제
    for (const t of Array.from(game.user.targets)) {
      t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true });
    }

    // 범위 하이라이트 정보 가져오기 (아이템 호출 시에만 체크)
    let rangeHighlightData = null;
    let range = 1;
    let hasRangeHighlight = false;
    const universalHandler = window.DX3rdUniversalHandler;
    
    // 아이템 호출 시(actorParam이 있을 때)만 범위 하이라이트 체크
    if (actorParam && universalHandler && universalHandler.rangeHighlightQueue) {
      const queue = universalHandler.rangeHighlightQueue;
      
      if (Array.isArray(queue)) {
        rangeHighlightData = queue.find(item => 
          item.actorId === actor.id || item.tokenId === sourceToken.id
        );
      } else if (typeof queue === "object" && queue !== null) {
        const queueArray = Object.values(queue);
        rangeHighlightData = queueArray.find(item => 
          item && (item.actorId === actor.id || item.tokenId === sourceToken.id)
        );
      }
      
      if (rangeHighlightData) {
        range = rangeHighlightData.range || 1;
        hasRangeHighlight = true;
      }
    }

    // 하이라이트된 그리드 목록 가져오기 (범위 하이라이트가 있을 때만)
    function getHighlightedGridSet() {
      if (!hasRangeHighlight || !universalHandler) return null;
      
      let highlightedGrids = [];
      if (range === 1) {
        highlightedGrids = universalHandler.getAdjacentGrids(sourceToken);
      } else {
        highlightedGrids = universalHandler.getGridsInRange(sourceToken, range);
      }
      
      const highlightedSet = new Set();
      for (const grid of highlightedGrids) {
        const gridOffset = canvas.grid.getOffset({ x: grid.x, y: grid.y });
        highlightedSet.add(`${gridOffset.i},${gridOffset.j}`);
      }
      return highlightedSet;
    }

    // 위치가 하이라이트 범위 내에 있는지 확인 (범위 하이라이트가 있을 때만)
    function isLocationInRange(location) {
      if (!hasRangeHighlight) return true; // 범위 하이라이트가 없으면 제한 없음
      
      const highlightedSet = getHighlightedGridSet();
      if (!highlightedSet) return true; // 그리드 세트를 가져올 수 없으면 제한 없음
      
      const locationOffset = canvas.grid.getOffset({ x: location.x, y: location.y });
      const locationKey = `${locationOffset.i},${locationOffset.j}`;
      return highlightedSet.has(locationKey);
    }

    // 3x3 = 그리드 3칸
    const sizeInSquares = 3;
    const pxSize = canvas.grid.size * sizeInSquares;
    const crosshairImage = getCrosshairImage();
    const crosshairSizeMultiplier = getCrosshairSize();
    const crosshairAlpha = getCrosshairAlpha();
    
    console.log("DX3RD-TARGET-ASSISTANT | 크로스헤어 이미지:", crosshairImage, "크기:", crosshairSizeMultiplier, "투명도:", crosshairAlpha);

    // 크로스헤어 활성화 상태 추적
    let isCrosshairActive = false;
    let originalReleaseAll = null;
    let tokenReleaseHandler = null;
    
    // canvas.tokens.releaseAll 메서드 오버라이드
    const preventReleaseAll = function(releaseOthers = true) {
      if (isCrosshairActive) {
        // 크로스헤어가 활성화된 동안은 releaseAll 무시
        return;
      }
      // 원래 메서드 호출
      if (originalReleaseAll) {
        return originalReleaseAll.call(this, releaseOthers);
      }
    };

    // 템플릿을 찍을 위치 선택 (크로스헤어) - 범위 내에서만 선택 가능
    let pos = null;
    let isValidPosition = false;
    let hasValidTargets = false;

    while (!isValidPosition || !hasValidTargets) {
      try {
        // 크로스헤어 활성화 시작
        isCrosshairActive = true;
        
        // 토큰 선택 해제 방지 설정
        originalReleaseAll = canvas.tokens.releaseAll;
        canvas.tokens.releaseAll = preventReleaseAll;
        
        // 마우스 이벤트로 인한 토큰 선택 해제 방지
        tokenReleaseHandler = (event) => {
          if (!isCrosshairActive) return;
          
          // 빈 공간 클릭으로 인한 선택 해제 방지
          const target = event.target;
          if (target && typeof target.classList === 'object' && target.classList) {
            const isBoardOrBackground = target.classList.contains("board") || target.classList.contains("background");
            
            if (isBoardOrBackground) {
              const controlledTokens = canvas.tokens.controlled;
              const hasSavedTokens = savedTokenIds.some(id => {
                const token = canvas.tokens.get(id);
                return token && token.controlled;
              });
              
              if (hasSavedTokens) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
              }
            }
          }
        };
        
        // 이벤트 리스너 추가
        canvas.app.stage.on("mousedown", tokenReleaseHandler);
        
        pos = await Sequencer.Crosshair.show(
          {
            size: sizeInSquares,
            gridHighlight: false,
            label: { text: "" },
            borderColor: "#000000",
            borderAlpha: 0,
            fillColor: "#000000",
            fillAlpha: 0,
          },
          {
            show: async (crosshair) => {
              console.log("DX3RD-TARGET-ASSISTANT | 크로스헤어 표시 중:", crosshair);
              try {
                await new Sequence()
                  .effect()
                  .file(crosshairImage)
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .aboveLighting()
                  .play();
              } catch (error) {
                console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 이미지 로드 오류:", error);
                // 기본 이미지로 재시도
                await new Sequence()
                  .effect()
                  .file("icons/svg/target.svg")
                  .attachTo(crosshair)
                  .persist()
                  .size({ width: pxSize * crosshairSizeMultiplier, height: pxSize * crosshairSizeMultiplier })
                  .opacity(crosshairAlpha)
                  .aboveLighting()
                  .play();
              }
            }
          }
        );
        
        // 크로스헤어가 닫혔으므로 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
      } catch (error) {
        console.error("DX3RD-TARGET-ASSISTANT | 크로스헤어 표시 오류:", error);
        ui.notifications.error("크로스헤어를 표시할 수 없습니다: " + error.message);
        
        // 에러 발생 시에도 크로스헤어 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        return;
      }

      if (!pos) {
        // 크로스헤어가 취소되었으므로 비활성화
        isCrosshairActive = false;
        
        // 토큰 선택 해제 방지 해제
        if (originalReleaseAll) {
          canvas.tokens.releaseAll = originalReleaseAll;
          originalReleaseAll = null;
        }
        
        if (tokenReleaseHandler) {
          canvas.app.stage.off("mousedown", tokenReleaseHandler);
          tokenReleaseHandler = null;
        }
        
        return;
      }

      // 선택한 위치가 하이라이트 범위 내에 있는지 확인 (범위 하이라이트가 있을 때만)
      if (isLocationInRange(pos)) {
        isValidPosition = true;
      } else {
        // 범위 하이라이트가 있을 때만 경고 표시
        if (hasRangeHighlight) {
          ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.OutOfRange"));
        } else {
          // 범위 하이라이트가 없으면 항상 유효한 위치로 간주
          isValidPosition = true;
        }
      }

      // 유효한 위치일 때만 타겟 확인
      if (isValidPosition) {
        // 선택한 위치(크로스헤어 중심)를 기준으로 3x3 범위의 좌상단 계산
        // 크로스헤어의 중심에서 왼쪽 위로 1.5칸 이동하면 좌상단이 됨
        const halfSize = canvas.grid.size * (sizeInSquares / 2);
        const topLeft = {
          x: pos.x - halfSize,
          y: pos.y - halfSize
        };

        const rect = {
          x1: topLeft.x,
          y1: topLeft.y,
          x2: topLeft.x + pxSize,
          y2: topLeft.y + pxSize,
        };

        // 두 사각형이 겹치는지 확인하는 함수
        function rectanglesIntersect(rect1, rect2) {
          return !(rect1.x2 <= rect2.x1 || 
                   rect1.x1 >= rect2.x2 || 
                   rect1.y2 <= rect2.y1 || 
                   rect1.y1 >= rect2.y2);
        }

        const targets = canvas.tokens.placeables.filter((token) => {
          if (!token?.actor) return false;
          
          // hide된 토큰은 무조건 제외
          if (isTokenHidden(token)) {
            return false;
          }
          
          // 은밀 무시 설정이 체크되지 않았고 stealth 컨디션이 있으면 제외
          if (!ignoreStealth && hasStealthCondition(token)) {
            return false;
          }
          
          // 액터 타입 필터링
          const actorType = token.actor.system?.actorType || token.actor.data?.data?.actorType || null;
          const sourceActorType = actor.system?.actorType || actor.data?.data?.actorType || null;
          
          if (targetType === "Area(Enemies)") {
            // destruction 타입의 berserk 컨디션이 있으면 액터 타입 필터링 없이 자신만 제외
            if (shouldExcludeSelfForBerserk) {
              if (actorParam && token.actor.id === actorParam.id) {
                return false; // 자신 제외
              }
              // 액터 타입 필터링 없이 모든 타입 선택 가능
            } else {
              // 실행 액터가 Enemy 또는 Troop이면 적은 PlayerCharacter 또는 Ally
              // 실행 액터가 PlayerCharacter 또는 Ally이면 적은 Enemy 또는 Troop
              if (sourceActorType === "Enemy" || sourceActorType === "Troop") {
                // 실행 액터가 적이면, 타겟은 아군(PlayerCharacter 또는 Ally)이어야 함
                if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
                  return false;
                }
              } else if (sourceActorType === "PlayerCharacter" || sourceActorType === "Ally") {
                // 실행 액터가 아군이면, 타겟은 적(Enemy 또는 Troop)이어야 함
                if (actorType !== "Enemy" && actorType !== "Troop") {
                  return false;
                }
              } else {
                // 실행 액터 타입이 불명확하면 기본 동작 (Enemy 또는 Troop)
                if (actorType !== "Enemy" && actorType !== "Troop") {
                  return false;
                }
              }
            }
          } else if (targetType === "Area(Allies)") {
            // 실행 액터가 Enemy 또는 Troop이면 아군은 Enemy 또는 Troop
            // 실행 액터가 PlayerCharacter 또는 Ally이면 아군은 PlayerCharacter 또는 Ally
            if (sourceActorType === "Enemy" || sourceActorType === "Troop") {
              // 실행 액터가 적이면, 타겟은 아군(Enemy 또는 Troop)이어야 함
              if (actorType !== "Enemy" && actorType !== "Troop") {
                return false;
              }
            } else if (sourceActorType === "PlayerCharacter" || sourceActorType === "Ally") {
              // 실행 액터가 아군이면, 타겟은 아군(PlayerCharacter 또는 Ally)이어야 함
              if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
                return false;
              }
            } else {
              // 실행 액터 타입이 불명확하면 기본 동작 (PlayerCharacter 또는 Ally)
              if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
                return false;
              }
            }
            
            // 자신 제외 설정이 체크되어 있으면 자신 제외
            if (excludeSelf && actorParam && token.actor.id === actorParam.id) {
              return false;
            }
          } else if (targetType === "Area") {
            // 범위 타입에서도 자신 제외 설정이 체크되어 있으면 자신 제외
            if (excludeSelf && actorParam && token.actor.id === actorParam.id) {
              return false;
            }
          }
          
          // 토큰의 경계 상자 계산
          const tokenWidth = token.w || (token.document.width * canvas.grid.size);
          const tokenHeight = token.h || (token.document.height * canvas.grid.size);
          const tokenRect = {
            x1: token.x,
            y1: token.y,
            x2: token.x + tokenWidth,
            y2: token.y + tokenHeight
          };
          
          // 범위와 토큰이 겹치는지 확인
          const intersects = rectanglesIntersect(rect, tokenRect);
          return intersects;
        });
        
        console.log("DX3RD-TARGET-ASSISTANT | 필터링된 타겟 개수:", targets.length, "targetType:", targetType, "excludeSelf:", excludeSelf);

        // 타겟이 없으면 다시 크로스헤어 표시
        if (targets.length === 0) {
          hasValidTargets = false;
          isValidPosition = false; // 위치를 다시 선택하도록
          continue;
        }

        hasValidTargets = true;

        for (const token of targets) {
          token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
        }
      }
    }
    
    // 크로스헤어 비활성화
    isCrosshairActive = false;
    
    // 토큰 선택 해제 방지 해제
    if (originalReleaseAll) {
      canvas.tokens.releaseAll = originalReleaseAll;
      originalReleaseAll = null;
    }
    
    if (tokenReleaseHandler) {
      canvas.app.stage.off("mousedown", tokenReleaseHandler);
      tokenReleaseHandler = null;
    }
    
    // 선택한 토큰 다시 선택
    for (const tokenId of savedTokenIds) {
      const savedToken = canvas.tokens.get(tokenId);
      if (savedToken) {
        savedToken.control({ releaseOthers: false });
      }
    }
  }

  /**
   * 장면 타겟 타게팅 실행 (하이라이트된 전체 범위)
   */
  async function executeSceneTargeting(item, actorParam = null) {
    console.log("DX3RD-TARGET-ASSISTANT | 장면 타겟 타게팅 시작");
    
    // 저장된 타게팅 설정 확인
    const savedTargeting = item.getFlag(MODULE_ID, "targeting") || {};
    const ignoreStealth = savedTargeting.ignoreStealth || false;
    const targetType = savedTargeting.targetType || "Scene";
    const excludeSelf = savedTargeting.excludeSelf || false;
    
    // destruction 타입의 berserk 컨디션 확인 (장면(적)에서도 자신 제외 적용)
    let shouldExcludeSelfForBerserk = false;
    if (actorParam) {
      shouldExcludeSelfForBerserk = shouldExcludeSelfForDestructionBerserk(item, actorParam);
    }
    
    // 전투 중에만 활성화 설정 확인
    if (shouldRequireCombat() && !isInCombat()) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CombatRequired"));
      return;
    }
    
    // 캔버스가 준비될 때까지 대기
    let retries = 0;
    const maxRetries = 50; // 최대 5초 대기 (100ms * 50)
    
    while (!canvas?.ready && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }
    
    if (!canvas?.ready) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.CanvasNotReady"));
      return;
    }
    
    // 하이라이트 표시 딜레이를 위한 추가 대기
    await new Promise(resolve => setTimeout(resolve, 100));

    // 액터 파라미터가 있으면 해당 액터의 토큰 찾기, 없으면 선택된 토큰 사용
    let sourceToken = null;
    let actor = null;
    let savedTokenIds = [];
    
    if (actorParam) {
      // 액터 파라미터가 있으면 해당 액터의 토큰 찾기
      actor = actorParam;
      const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === actor.id);
      if (tokens.length > 0) {
        sourceToken = tokens[0];
        // 해당 토큰 선택
        sourceToken.control({ releaseOthers: true });
        savedTokenIds = [sourceToken.id];
      } else {
        ui.notifications.warn("액터에 해당하는 토큰을 찾을 수 없습니다.");
        return;
      }
    } else {
      // 액터 파라미터가 없으면 선택된 토큰 사용 (수동 실행 시)
      const controlledTokens = canvas.tokens.controlled;
      if (controlledTokens.length === 0) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.NoTokenSelected"));
        return;
      }
      
      sourceToken = controlledTokens[0];
      actor = sourceToken.actor;
      
      if (!actor) {
        ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.ActorNotFound"));
        return;
      }
      
      savedTokenIds = controlledTokens.map(t => t.id);
    }

    // 기존 타겟 해제
    for (const t of Array.from(game.user.targets)) {
      t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true });
    }

    // 범위 하이라이트 정보 가져오기 (아이템 호출 시에만 체크)
    let rangeHighlightData = null;
    let range = 1;
    let hasRangeHighlight = false;
    const universalHandler = window.DX3rdUniversalHandler;
    
    // 아이템 호출 시(actorParam이 있을 때)만 범위 하이라이트 체크
    if (actorParam && universalHandler && universalHandler.rangeHighlightQueue) {
      const queue = universalHandler.rangeHighlightQueue;
      
      if (Array.isArray(queue)) {
        rangeHighlightData = queue.find(item => 
          item.actorId === actor.id || item.tokenId === sourceToken.id
        );
      } else if (typeof queue === "object" && queue !== null) {
        const queueArray = Object.values(queue);
        rangeHighlightData = queueArray.find(item => 
          item && (item.actorId === actor.id || item.tokenId === sourceToken.id)
        );
      }
      
      if (rangeHighlightData) {
        range = rangeHighlightData.range || 1;
        hasRangeHighlight = true;
      }
    }

    // 하이라이트가 없으면 경고
    if (!hasRangeHighlight) {
      ui.notifications.warn(game.i18n.localize("DX3RD-TARGET-ASSISTANT.NoRangeHighlight"));
      return;
    }

    // 하이라이트된 그리드 목록 가져오기
    function getHighlightedGridSet() {
      if (!hasRangeHighlight || !universalHandler) return null;
      
      let highlightedGrids = [];
      if (range === 1) {
        highlightedGrids = universalHandler.getAdjacentGrids(sourceToken);
      } else {
        highlightedGrids = universalHandler.getGridsInRange(sourceToken, range);
      }
      
      const highlightedSet = new Set();
      for (const grid of highlightedGrids) {
        const gridOffset = canvas.grid.getOffset({ x: grid.x, y: grid.y });
        highlightedSet.add(`${gridOffset.i},${gridOffset.j}`);
      }
      return highlightedSet;
    }

    // 토큰의 위치가 하이라이트 범위 내에 있는지 확인
    function isTokenInHighlightedRange(token) {
      const highlightedSet = getHighlightedGridSet();
      if (!highlightedSet) return false;
      
      // 토큰의 중심 위치를 그리드 좌표로 변환
      const tokenCenter = {
        x: token.x + (token.w || token.document.width * canvas.grid.size) / 2,
        y: token.y + (token.h || token.document.height * canvas.grid.size) / 2
      };
      
      const tokenOffset = canvas.grid.getOffset({ x: tokenCenter.x, y: tokenCenter.y });
      const tokenKey = `${tokenOffset.i},${tokenOffset.j}`;
      
      return highlightedSet.has(tokenKey);
    }

    const highlightedSet = getHighlightedGridSet();
    if (!highlightedSet) {
      ui.notifications.warn("하이라이트된 범위를 찾을 수 없습니다.");
      return;
    }

    // 하이라이트된 범위 내의 모든 토큰 필터링
    const targets = canvas.tokens.placeables.filter((token) => {
      if (!token?.actor) return false;
      
      // 하이라이트 범위 내에 있는지 확인
      if (!isTokenInHighlightedRange(token)) {
        return false;
      }
      
      // hide된 토큰은 무조건 제외
      if (isTokenHidden(token)) {
        return false;
      }
      
      // 은밀 무시 설정이 체크되지 않았고 stealth 컨디션이 있으면 제외
      if (!ignoreStealth && hasStealthCondition(token)) {
        return false;
      }
      
      // 액터 타입 필터링
      const actorType = token.actor.system?.actorType || token.actor.data?.data?.actorType || null;
      const sourceActorType = actor.system?.actorType || actor.data?.data?.actorType || null;
      
      if (targetType === "Scene(Enemies)") {
        // destruction 타입의 berserk 컨디션이 있으면 액터 타입 필터링 없이 자신만 제외
        if (shouldExcludeSelfForBerserk) {
          if (actorParam && token.actor.id === actorParam.id) {
            return false; // 자신 제외
          }
          // 액터 타입 필터링 없이 모든 타입 선택 가능
        } else {
          // 실행 액터가 Enemy 또는 Troop이면 적은 PlayerCharacter 또는 Ally
          // 실행 액터가 PlayerCharacter 또는 Ally이면 적은 Enemy 또는 Troop
          if (sourceActorType === "Enemy" || sourceActorType === "Troop") {
            // 실행 액터가 적이면, 타겟은 아군(PlayerCharacter 또는 Ally)이어야 함
            if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
              return false;
            }
          } else if (sourceActorType === "PlayerCharacter" || sourceActorType === "Ally") {
            // 실행 액터가 아군이면, 타겟은 적(Enemy 또는 Troop)이어야 함
            if (actorType !== "Enemy" && actorType !== "Troop") {
              return false;
            }
          } else {
            // 실행 액터 타입이 불명확하면 기본 동작 (Enemy 또는 Troop)
            if (actorType !== "Enemy" && actorType !== "Troop") {
              return false;
            }
          }
        }
      } else if (targetType === "Scene(Allies)") {
        // 실행 액터가 Enemy 또는 Troop이면 아군은 Enemy 또는 Troop
        // 실행 액터가 PlayerCharacter 또는 Ally이면 아군은 PlayerCharacter 또는 Ally
        if (sourceActorType === "Enemy" || sourceActorType === "Troop") {
          // 실행 액터가 적이면, 타겟은 아군(Enemy 또는 Troop)이어야 함
          if (actorType !== "Enemy" && actorType !== "Troop") {
            return false;
          }
        } else if (sourceActorType === "PlayerCharacter" || sourceActorType === "Ally") {
          // 실행 액터가 아군이면, 타겟은 아군(PlayerCharacter 또는 Ally)이어야 함
          if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
            return false;
          }
        } else {
          // 실행 액터 타입이 불명확하면 기본 동작 (PlayerCharacter 또는 Ally)
          if (actorType !== "PlayerCharacter" && actorType !== "Ally") {
            return false;
          }
        }
        
        // 자신 제외 설정이 체크되어 있으면 자신 제외
        if (excludeSelf && actorParam && token.actor.id === actorParam.id) {
          return false;
        }
      } else if (targetType === "Scene") {
        // 장면 타입에서도 자신 제외 설정이 체크되어 있으면 자신 제외
        if (excludeSelf && actorParam && token.actor.id === actorParam.id) {
          return false;
        }
      }
      
      return true;
    });

    // 타겟으로 설정
    for (const token of targets) {
      token.setTarget(true, { user: game.user, releaseOthers: false, groupSelection: true });
    }
    
    // 선택한 토큰 다시 선택
    for (const tokenId of savedTokenIds) {
      const savedToken = canvas.tokens.get(tokenId);
      if (savedToken) {
        savedToken.control({ releaseOthers: false });
      }
    }
  }
  
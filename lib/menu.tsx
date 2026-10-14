"use client";

import { createContext, useContext } from "react";

/** Opens the side menu, which the app shell owns (so every screen and the edge swipe share one menu). */
export const MenuContext = createContext<{ openMenu: () => void }>({ openMenu: () => {} });
export const useMenu = () => useContext(MenuContext);

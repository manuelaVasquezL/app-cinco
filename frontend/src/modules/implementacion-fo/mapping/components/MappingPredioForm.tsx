"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import {
  MapPin,
  Building2,
  Home,
  Store,
  Layers,
  Save,
  RotateCcw,
  Navigation,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { mappingPredioService } from "../services/mappingPredio.service";
import { MappingPredio, CuadraCheckResult, DireccionCheckResult } from "../types";
import { AlertaCuadraBanner } from "./AlertaCuadraBanner";
import { AlertaDireccionFlotante } from "./AlertaDireccionFlotante";
import {
  DireccionCamposGroup,
  parsearCalle,
  componerCalle,
} from "./DireccionCamposGroup";
import { obtenerGeolocalizacionPrecisa } from "@/utils/geolocation";

interface MappingPredioFormProps {
  predioEditando?: MappingPredio | null;
  onGuardadoExitoso?: (predio: MappingPredio) => void;
  onCancelarEdicion?: () => void;
}

export const MappingPredioForm: React.FC<MappingPredioFormProps> = ({
  predioEditando,
  onGuardadoExitoso,
  onCancelarEdicion,
}) => {
  const [, startTransition] = useTransition();

  // Estados del formulario - Datos generales
  const [nombreConjunto, setNombreConjunto] = useState("");
  const [barrio, setBarrio] = useState("");
  const [loteAmp, setLoteAmp] = useState("");

  // Dirección Principal
  const [tipoVia, setTipoVia] = useState("CL");
  const [numeroVia, setNumeroVia] = useState("");
  const [nombreCalleLibre, setNombreCalleLibre] = useState("");
  const [placaUnidad, setPlacaUnidad] = useState("");
  const [interior, setInterior] = useState("");

  // Conteo de unidades
  const [numCasas, setNumCasas] = useState(0);
  const [numApartamentos, setNumApartamentos] = useState(0);
  const [numLocales, setNumLocales] = useState(0);
  const [numPisos, setNumPisos] = useState(1);

  // Direcciones Alternativas
  const [mostrarAlternas, setMostrarAlternas] = useState(true);
  const [tipoViaAlt2, setTipoViaAlt2] = useState("CL");
  const [numeroViaAlt2, setNumeroViaAlt2] = useState("");
  const [nombreCalleLibreAlt2, setNombreCalleLibreAlt2] = useState("");
  const [placaAlterna2, setPlacaAlterna2] = useState("");

  const [tipoViaAlt3, setTipoViaAlt3] = useState("CL");
  const [numeroViaAlt3, setNumeroViaAlt3] = useState("");
  const [nombreCalleLibreAlt3, setNombreCalleLibreAlt3] = useState("");
  const [placaAlterna3, setPlacaAlterna3] = useState("");

  const [distribucion, setDistribucion] = useState("");
  const [latitud, setLatitud] = useState<string>("");
  const [longitud, setLongitud] = useState<string>("");
  const [observaciones, setObservaciones] = useState("");

  // Sugerencias de Barrios y Planchas
  const [sugerenciasBarrios, setSugerenciasBarrios] = useState<string[]>([]);
  const [mostrarSugerenciasBarrio, setMostrarSugerenciasBarrio] = useState(false);
  const [barriosSharePoint, setBarriosSharePoint] = useState<Array<{ barrio: string; descripcion?: string }>>([]);
  const [modoManualBarrio, setModoManualBarrio] = useState(false);

  // Alertas tempranas
  const [cuadraCheck, setCuadraCheck] = useState<CuadraCheckResult | null>(null);
  const [isLoadingCuadraCheck, setIsLoadingCuadraCheck] = useState(false);
  const [direccionCheck, setDireccionCheck] = useState<DireccionCheckResult | null>(null);

  // Estado de carga y GPS
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);

  // Derivar nombre de calle principal unificado
  const calleCalculada = componerCalle(tipoVia, numeroVia, nombreCalleLibre);

  // Cargar datos en caso de edición
  useEffect(() => {
    if (predioEditando) {
      setNombreConjunto(predioEditando.nombre_conjunto || "");

      // Parsear dirección principal
      const pPrincipal = parsearCalle(predioEditando.nombre_calle || "");
      setTipoVia(pPrincipal.tipoVia);
      setNumeroVia(pPrincipal.numeroVia);
      setNombreCalleLibre(pPrincipal.nombreCalleLibre);
      setPlacaUnidad(predioEditando.placa_unidad || "");
      setInterior(predioEditando.interior || "");

      // Parsear dirección alterna 2
      const pAlt2 = parsearCalle(predioEditando.calle_alterna_2 || "");
      setTipoViaAlt2(pAlt2.tipoVia);
      setNumeroViaAlt2(pAlt2.numeroVia);
      setNombreCalleLibreAlt2(pAlt2.nombreCalleLibre);
      setPlacaAlterna2(predioEditando.placa_alterna_2 || "");

      // Parsear dirección alterna 3
      const pAlt3 = parsearCalle(predioEditando.calle_alterna_3 || "");
      setTipoViaAlt3(pAlt3.tipoVia);
      setNumeroViaAlt3(pAlt3.numeroVia);
      setNombreCalleLibreAlt3(pAlt3.nombreCalleLibre);
      setPlacaAlterna3(predioEditando.placa_alterna_3 || "");

      setBarrio(predioEditando.barrio || "");
      setLoteAmp(predioEditando.lote_amp || "");
      setNumCasas(predioEditando.num_casas || 0);
      setNumApartamentos(predioEditando.num_apartamentos || 0);
      setNumLocales(predioEditando.num_locales || 0);
      setNumPisos(predioEditando.num_pisos || 1);
      setDistribucion(predioEditando.distribucion || "");
      setLatitud(predioEditando.latitud ? String(predioEditando.latitud) : "");
      setLongitud(predioEditando.longitud ? String(predioEditando.longitud) : "");
      setObservaciones(predioEditando.observaciones || "");

      if (predioEditando.calle_alterna_2 || predioEditando.calle_alterna_3) {
        setMostrarAlternas(true);
      }
    }
  }, [predioEditando]);

  // Cargar barrios sugeridos iniciales y barrios enlazados a SharePoint
  useEffect(() => {
    mappingPredioService
      .getBarriosSugeridos()
      .then((barrios) => setSugerenciasBarrios(barrios))
      .catch(() => { });

    mappingPredioService
      .getBarriosSharePoint()
      .then((items) => setBarriosSharePoint(items))
      .catch(() => { });
  }, []);

  // Alerta temprana: Detección de cuadra o plancha ya levantada
  useEffect(() => {
    if (!barrio.trim() || !loteAmp.trim() || predioEditando) {
      setCuadraCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingCuadraCheck(true);
      try {
        const res = await mappingPredioService.verificarCuadra(
          barrio.trim(),
          loteAmp.trim(),
          calleCalculada || undefined,
        );
        setCuadraCheck(res);
      } catch {
        // Silencioso
      } finally {
        setIsLoadingCuadraCheck(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [barrio, loteAmp, calleCalculada, predioEditando]);

  // Alerta no bloqueante: Detección en vivo de dirección similar
  useEffect(() => {
    if (!calleCalculada || !placaUnidad.trim()) {
      setDireccionCheck(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await mappingPredioService.verificarDireccion(
          calleCalculada,
          placaUnidad.trim(),
          interior.trim() || undefined,
          predioEditando?.id,
        );
        setDireccionCheck(res);
      } catch {
        // Silencioso
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [calleCalculada, placaUnidad, interior, predioEditando]);

  // Captura satelital de GPS de alta precisión en 1 clic
  const handleObtenerGps = async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      toast.error("La geolocalización no es soportada por este navegador");
      return;
    }

    setIsGettingGps(true);
    const toastId = toast.loading("Obteniendo ubicación... lectura 1/4...");

    try {
      const res = await obtenerGeolocalizacionPrecisa({
        maxIntentos: 4,
        umbralPrecision: 15,
        timeoutPorIntento: 7000,
        onProgreso: ({ intento, maxIntentos, precisionActual }) => {
          const textoPrecision =
            precisionActual !== undefined ? ` (precisión actual ±${precisionActual}m)` : "";
          toast.loading(
            `Obteniendo ubicación... lectura ${intento}/${maxIntentos}${textoPrecision}...`,
            { id: toastId }
          );
        },
      });

      const lat = res.latitud.toFixed(6);
      const lng = res.longitud.toFixed(6);
      setLatitud(lat);
      setLongitud(lng);

      if (res.esOptima) {
        toast.success(`GPS capturado con precisión óptima de ±${res.precision}m`, {
          id: toastId,
          description: `Lat: ${lat}, Long: ${lng}`,
        });
      } else {
        toast.warning(`GPS capturado con precisión de ±${res.precision}m`, {
          id: toastId,
          description: `Lat: ${lat}, Long: ${lng}`,
        });
      }
    } catch (error: any) {
      toast.error(error.message || "No se pudo obtener la ubicación GPS.", { id: toastId });
    } finally {
      setIsGettingGps(false);
    }
  };

  const handleLimpiarFormulario = () => {
    setNombreConjunto("");
    setTipoVia("CL");
    setNumeroVia("");
    setNombreCalleLibre("");
    setPlacaUnidad("");
    setInterior("");
    setBarrio("");
    setLoteAmp("");
    setNumCasas(0);
    setNumApartamentos(0);
    setNumLocales(0);
    setNumPisos(1);
    setTipoViaAlt2("CL");
    setNumeroViaAlt2("");
    setNombreCalleLibreAlt2("");
    setPlacaAlterna2("");
    setTipoViaAlt3("CL");
    setNumeroViaAlt3("");
    setNombreCalleLibreAlt3("");
    setPlacaAlterna3("");
    setDistribucion("");
    setLatitud("");
    setLongitud("");
    setObservaciones("");
    setCuadraCheck(null);
    setDireccionCheck(null);
  };

  const handleSubmit = async () => {
    // Validaciones mínimas no bloqueantes
    if (!calleCalculada && !nombreConjunto.trim()) {
      toast.error("Ingresa al menos la vía principal o el nombre del conjunto/edificio.");
      return;
    }

    if (!placaUnidad.trim() && !nombreConjunto.trim()) {
      toast.error("Ingresa la placa del predio o el nombre del conjunto.");
      return;
    }

    setIsSubmitting(true);

    const calleAlt2 = componerCalle(tipoViaAlt2, numeroViaAlt2, nombreCalleLibreAlt2);
    const calleAlt3 = componerCalle(tipoViaAlt3, numeroViaAlt3, nombreCalleLibreAlt3);
    const placaAlt2 = placaAlterna2.trim().toUpperCase();
    const placaAlt3 = placaAlterna3.trim().toUpperCase();

    const payload: Partial<MappingPredio> = {
      nombre_conjunto: nombreConjunto.trim().toUpperCase(),
      nombre_calle: calleCalculada,
      placa_unidad: placaUnidad.trim().toUpperCase(),
      interior: interior.trim().toUpperCase(),
      barrio: barrio.trim().toUpperCase(),
      lote_amp: loteAmp.trim().toUpperCase(),
      num_casas: Number(numCasas) || 0,
      num_apartamentos: Number(numApartamentos) || 0,
      num_locales: Number(numLocales) || 0,
      num_pisos: Math.max(1, Number(numPisos) || 1),
      calle_alterna_2: calleAlt2,
      placa_alterna_2: (calleAlt2 || placaAlt2) ? placaAlt2 : "",
      calle_alterna_3: calleAlt3,
      placa_alterna_3: (calleAlt3 || placaAlt3) ? placaAlt3 : "",
      distribucion: distribucion.trim().toUpperCase(),
      latitud: latitud ? String(latitud).replace(",", ".") : null,
      longitud: longitud ? String(longitud).replace(",", ".") : null,
      observaciones: observaciones.trim(),
    };

    try {
      let resultado: MappingPredio;
      if (predioEditando) {
        resultado = await mappingPredioService.actualizar(predioEditando.id, payload);
        toast.success("Predio actualizado exitosamente");
      } else {
        resultado = await mappingPredioService.crear(payload);
        toast.success("Predio registrado correctamente", {
          description: `${resultado.direccion_completa} (${resultado.total_unidades} unidades)`,
        });
      }

      handleLimpiarFormulario();

      if (onGuardadoExitoso) {
        onGuardadoExitoso(resultado);
      }
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.detail ||
        error?.message ||
        "No se pudo guardar el predio. Revisa los datos.";
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalUnidades = (Number(numCasas) || 0) + (Number(numApartamentos) || 0) + (Number(numLocales) || 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
    >
      {/* Banner de alerta temprana si la cuadra o plancha ya fue censada */}
      <AlertaCuadraBanner
        checkResult={cuadraCheck}
        isLoading={isLoadingCuadraCheck}
        onIgnorar={() => setCuadraCheck(null)}
      />

      {/* Alerta de dirección repetida no bloqueante */}
      <AlertaDireccionFlotante checkResult={direccionCheck} />

      {/* Resumen de unidades calculadas */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Diligencia los datos del mapping
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Total unidades:</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold ${totalUnidades > 0
                ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
          >
            <Sparkles className="h-3 w-3" />
            {totalUnidades} unidad{totalUnidades === 1 ? "" : "es"}
          </span>
        </div>
      </div>

      {/* SECCIÓN 1: UBICACIÓN Y PLANCHA (AMP) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
          <MapPin className="h-4 w-4 text-brand-500 dark:text-brand-400" />
          1. Sector y Plancha Cartográfica
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Barrio con selector de SharePoint o autocompletado */}
          <div className="relative">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Barrio <span className="text-red-500">*</span>
              </label>
              {barriosSharePoint.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModoManualBarrio(!modoManualBarrio)}
                  className="text-[10px] text-brand-600 hover:underline dark:text-brand-400 font-medium"
                >
                  {modoManualBarrio ? "Ver selector" : "Escribir manual"}
                </button>
              )}
            </div>

            {barriosSharePoint.length > 0 && !modoManualBarrio ? (
              <select
                value={barrio}
                onChange={(e) => setBarrio(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option value="">-- Selecciona el barrio --</option>
                {barriosSharePoint.map((b) => (
                  <option key={b.barrio} value={b.barrio}>
                    {b.barrio}
                  </option>
                ))}
              </select>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={barrio}
                  onChange={(e) => {
                    setBarrio(e.target.value.toUpperCase());
                    setMostrarSugerenciasBarrio(true);
                  }}
                  onFocus={() => setMostrarSugerenciasBarrio(true)}
                  placeholder="Ej: BELEN, LAURELES, ROBLEDO"
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                {/* Lista desplegable de sugerencias de barrio */}
                {mostrarSugerenciasBarrio && sugerenciasBarrios.length > 0 && barrio && (
                  <ul className="absolute z-30 mt-1 max-h-40 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-xs shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {sugerenciasBarrios
                      .filter((b) => b.toUpperCase().includes(barrio.toUpperCase()))
                      .slice(0, 8)
                      .map((sug) => (
                        <li
                          key={sug}
                          onClick={() => {
                            setBarrio(sug);
                            setMostrarSugerenciasBarrio(false);
                          }}
                          className="cursor-pointer px-3 py-1.5 hover:bg-brand-50 text-gray-800 dark:text-gray-200 dark:hover:bg-brand-950/40"
                        >
                          {sug}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Lote / Plancha AMP */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              AMP <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={loteAmp}
              onChange={(e) => setLoteAmp(e.target.value.toUpperCase())}
              placeholder="Ej: 1, 102A, MZ-4"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
            <span className="text-[11px] text-gray-500">Lote marcado en la plancha de campo</span>
          </div>

          {/* Nombre Conjunto / Edificio */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Nombre Conjunto
            </label>
            <input
              type="text"
              value={nombreConjunto}
              onChange={(e) => setNombreConjunto(e.target.value.toUpperCase())}
              placeholder="Ej: EDIFICIO NUEVO MILENIUM"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: DIRECCIÓN PRINCIPAL */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
          <Navigation className="h-4 w-4 text-brand-500 dark:text-brand-400" />
          2. Dirección Principal del Predio
        </h3>

        <DireccionCamposGroup
          tipoVia={tipoVia}
          onTipoViaChange={setTipoVia}
          numeroVia={numeroVia}
          onNumeroViaChange={setNumeroVia}
          nombreCalleLibre={nombreCalleLibre}
          onNombreCalleLibreChange={setNombreCalleLibre}
          placa={placaUnidad}
          onPlacaChange={setPlacaUnidad}
          interior={interior}
          onInteriorChange={setInterior}
          mostrarInterior={true}
          esObligatoria={true}
          labelVia="Número / Letra de la Vía"
          labelPlaca="Placa / Número (PLACAUNIDA)"
        />
      </div>

      {/* SECCIÓN 3: CONTEO DE INMUEBLES Y PISOS */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
          <Building2 className="h-4 w-4 text-brand-500 dark:text-brand-400" />
          3. Tipología y Conteo de Inmuebles
        </h3>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Casas */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Home className="h-3.5 w-3.5 text-brand-500" />
                Casas
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setNumCasas(Math.max(0, numCasas - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={numCasas}
                onChange={(e) => setNumCasas(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center text-base font-bold text-gray-900 focus:outline-hidden dark:text-white"
              />
              <button
                type="button"
                onClick={() => setNumCasas(numCasas + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* Apartamentos */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Building2 className="h-3.5 w-3.5 text-brand-600" />
                Apartamentos
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setNumApartamentos(Math.max(0, numApartamentos - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={numApartamentos}
                onChange={(e) => setNumApartamentos(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center text-base font-bold text-gray-900 focus:outline-hidden dark:text-white"
              />
              <button
                type="button"
                onClick={() => setNumApartamentos(numApartamentos + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* Locales */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Store className="h-3.5 w-3.5 text-emerald-600" />
                Locales
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setNumLocales(Math.max(0, numLocales - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                -
              </button>
              <input
                type="number"
                min="0"
                value={numLocales}
                onChange={(e) => setNumLocales(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 text-center text-base font-bold text-gray-900 focus:outline-hidden dark:text-white"
              />
              <button
                type="button"
                onClick={() => setNumLocales(numLocales + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                +
              </button>
            </div>
          </div>

          {/* Pisos */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Layers className="h-3.5 w-3.5 text-brand-700" />
                Pisos
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setNumPisos(Math.max(1, numPisos - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                -
              </button>
              <input
                type="number"
                min="1"
                value={numPisos}
                onChange={(e) => setNumPisos(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 text-center text-base font-bold text-gray-900 focus:outline-hidden dark:text-white"
              />
              <button
                type="button"
                onClick={() => setNumPisos(numPisos + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-base font-bold hover:bg-gray-100 active:scale-95 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN 4: DISTRIBUCIÓN Y GEORREFERENCIACIÓN (GPS) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
          <MapPin className="h-4 w-4 text-brand-500 dark:text-brand-400" />
          4. Distribución Interna y Coordenadas GPS
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Distribución */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Distribución Interna de Unidades
            </label>
            <input
              type="text"
              value={distribucion}
              onChange={(e) => setDistribucion(e.target.value.toUpperCase())}
              placeholder="Ej: AP 101-102-103-201-202-203 o LC 1-2"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Latitud (CORDX) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Latitud (CORDX)
            </label>
            <input
              type="text"
              value={latitud}
              onChange={(e) => setLatitud(e.target.value)}
              placeholder="Ej: 6.308625"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Longitud (CORDY) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Longitud (CORDY)
            </label>
            <input
              type="text"
              value={longitud}
              onChange={(e) => setLongitud(e.target.value)}
              placeholder="Ej: -75.545410"
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>

        {/* Botones de acción GPS */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleObtenerGps}
            disabled={isGettingGps}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isGettingGps ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Tomar Ubicación Actual
          </button>

          {latitud && longitud && (
            <a
              href={`https://www.google.com/maps?q=${latitud},${longitud}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <ExternalLink className="h-3.5 w-3.5 text-brand-500" />
              Verificar en Google Maps
            </a>
          )}
        </div>
      </div>

      {/* SECCIÓN 5: DIRECCIONES ALTERNATIVAS (COLAPSABLE / ACORDEÓN) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setMostrarAlternas(!mostrarAlternas)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-800 dark:text-gray-200">
            5. Direcciones Alternativas
          </span>
          <span className="rounded-md border border-gray-200 bg-gray-100 p-1 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {mostrarAlternas ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {mostrarAlternas && (
          <div className="mt-4 space-y-5 pt-3 border-t border-gray-100 dark:border-gray-800">
            {/* Alterna 2 */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800/80 dark:bg-gray-800/30">
              <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Dirección Alternativa 2
              </span>
              <DireccionCamposGroup
                tipoVia={tipoViaAlt2}
                onTipoViaChange={setTipoViaAlt2}
                numeroVia={numeroViaAlt2}
                onNumeroViaChange={setNumeroViaAlt2}
                nombreCalleLibre={nombreCalleLibreAlt2}
                onNombreCalleLibreChange={setNombreCalleLibreAlt2}
                placa={placaAlterna2}
                onPlacaChange={setPlacaAlterna2}
                mostrarInterior={false}
                esObligatoria={false}
                labelVia="Vía Alternativa 2"
                labelPlaca="Placa Alternativa 2"
              />
            </div>

            {/* Alterna 3 */}
            <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 dark:border-gray-800/80 dark:bg-gray-800/30">
              <span className="mb-3 block text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                Dirección Alternativa 3
              </span>
              <DireccionCamposGroup
                tipoVia={tipoViaAlt3}
                onTipoViaChange={setTipoViaAlt3}
                numeroVia={numeroViaAlt3}
                onNumeroViaChange={setNumeroViaAlt3}
                nombreCalleLibre={nombreCalleLibreAlt3}
                onNombreCalleLibreChange={setNombreCalleLibreAlt3}
                placa={placaAlterna3}
                onPlacaChange={setPlacaAlterna3}
                mostrarInterior={false}
                esObligatoria={false}
                labelVia="Vía Alternativa 3"
                labelPlaca="Placa Alternativa 3"
              />
            </div>
          </div>
        )}
      </div>

      {/* BOTONES PRINCIPALES DE ACCIÓN */}
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex items-center gap-2">
          {predioEditando ? (
            <button
              type="button"
              onClick={onCancelarEdicion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
            >
              Cancelar Edición
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLimpiarFormulario}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar Campos
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-brand-600 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {predioEditando ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
};

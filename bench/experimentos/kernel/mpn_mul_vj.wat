(module
  ;; Function 140 of site/lean-vir/wasm/vir-upstream.wasm, copied verbatim (wasm2wat, wabt 1.0.37): Lean's
  ;; mpn_mul (src/runtime/mpn.cpp, the GMP-free schoolbook multiplication, 32-bit digits) as the C++
  ;; compiler emitted it. mpn_mul(a, lnga, b, lngb, c): c[0 .. lnga+lngb) = a * b.
  ;; Lean's runtime: Copyright (c) 2011 Microsoft Corporation, Apache License 2.0.
  ;; VARIANT: the multiplier digit b[j] is loaded once per row (local 17) instead of twice per
  ;; iteration of the unrolled inner loop; nothing else changes.
  (memory (export "mem") 64)
  (func (export "mpn_mul") (param i32 i32 i32 i32 i32)
    (local i32 i32 i32 i32 i32 i32 i32 i32 i32 i32 i64 i32 i64)
    block  ;; label = @1
      block  ;; label = @2
        local.get 1
        br_if 0 (;@2;)
        local.get 3
        i32.eqz
        br_if 1 (;@1;)
        local.get 3
        i32.const 7
        i32.and
        local.set 5
        i32.const 0
        local.set 6
        block  ;; label = @3
          local.get 3
          i32.const 8
          i32.lt_u
          br_if 0 (;@3;)
          local.get 4
          local.get 1
          i32.const 2
          i32.shl
          i32.add
          local.set 7
          local.get 3
          i32.const -8
          i32.and
          local.set 8
          i32.const 0
          local.set 6
          loop  ;; label = @4
            local.get 7
            i64.const 0
            i64.store align=4
            local.get 7
            i32.const 24
            i32.add
            i64.const 0
            i64.store align=4
            local.get 7
            i32.const 16
            i32.add
            i64.const 0
            i64.store align=4
            local.get 7
            i32.const 8
            i32.add
            i64.const 0
            i64.store align=4
            local.get 7
            i32.const 32
            i32.add
            local.set 7
            local.get 8
            local.get 6
            i32.const 8
            i32.add
            local.tee 6
            i32.ne
            br_if 0 (;@4;)
          end
          local.get 5
          i32.eqz
          br_if 2 (;@1;)
        end
        local.get 4
        local.get 6
        i32.const 2
        i32.shl
        local.get 1
        i32.const 2
        i32.shl
        i32.add
        i32.add
        local.set 7
        loop  ;; label = @3
          local.get 7
          i32.const 0
          i32.store
          local.get 7
          i32.const 4
          i32.add
          local.set 7
          local.get 5
          i32.const -1
          i32.add
          local.tee 5
          br_if 0 (;@3;)
          br 2 (;@1;)
        end
      end
      block  ;; label = @2
        local.get 1
        i32.const 2
        i32.shl
        local.tee 7
        i32.eqz
        br_if 0 (;@2;)
        local.get 4
        i32.const 0
        local.get 7
        memory.fill
      end
      local.get 3
      i32.eqz
      br_if 0 (;@1;)
      local.get 4
      local.get 7
      i32.add
      local.set 9
      local.get 1
      i32.const -2
      i32.and
      local.set 10
      local.get 1
      i32.const 1
      i32.and
      local.set 11
      i32.const 0
      local.set 12
      local.get 4
      local.set 13
      loop  ;; label = @2
        i32.const 0
        local.set 7
        block  ;; label = @3
          local.get 2
          local.get 12
          i32.const 2
          i32.shl
          local.tee 14
          i32.add
          local.tee 6
          i32.load
          i32.eqz
          br_if 0 (;@3;)
          i64.const 0
          local.set 15
          i32.const 0
          local.set 8
          block  ;; label = @4
            block  ;; label = @5
              local.get 1
              i32.const 1
              i32.eq
              br_if 0 (;@5;)
              local.get 13
              local.set 7
              local.get 0
              local.set 5
              local.get 6       ;; added: b[j] loaded once per row
              i64.load32_u
              local.set 17
              loop  ;; label = @6
                local.get 7
                local.get 15
                local.get 7
                i64.load32_u
                i64.add
                local.get 17      ;; was: local.get 6, i64.load32_u
                local.get 5
                i64.load32_u
                i64.mul
                i64.add
                local.tee 15
                i64.store32
                local.get 7
                i32.const 4
                i32.add
                local.tee 16
                local.get 15
                i64.const 32
                i64.shr_u
                local.get 16
                i64.load32_u
                i64.add
                local.get 17      ;; was: local.get 6, i64.load32_u
                local.get 5
                i32.const 4
                i32.add
                i64.load32_u
                i64.mul
                i64.add
                local.tee 15
                i64.store32
                local.get 15
                i64.const 32
                i64.shr_u
                local.set 15
                local.get 7
                i32.const 8
                i32.add
                local.set 7
                local.get 5
                i32.const 8
                i32.add
                local.set 5
                local.get 10
                local.get 8
                i32.const 2
                i32.add
                local.tee 8
                i32.ne
                br_if 0 (;@6;)
              end
              local.get 11
              i32.eqz
              br_if 1 (;@4;)
            end
            local.get 4
            local.get 14
            i32.add
            local.get 8
            i32.const 2
            i32.shl
            local.tee 7
            i32.add
            local.tee 5
            local.get 15
            local.get 5
            i64.load32_u
            i64.add
            local.get 6
            i64.load32_u
            local.get 0
            local.get 7
            i32.add
            i64.load32_u
            i64.mul
            i64.add
            local.tee 15
            i64.store32
            local.get 15
            i64.const 32
            i64.shr_u
            local.set 15
          end
          local.get 15
          i32.wrap_i64
          local.set 7
        end
        local.get 9
        local.get 14
        i32.add
        local.get 7
        i32.store
        local.get 13
        i32.const 4
        i32.add
        local.set 13
        local.get 12
        i32.const 1
        i32.add
        local.tee 12
        local.get 3
        i32.ne
        br_if 0 (;@2;)
      end
    end)
)
